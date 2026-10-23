"""Run with: python -m unittest discover -s tests/python -v"""

import contextlib
import importlib.util
import io
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

PROJECT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('packaging_build', PROJECT / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class BuildScriptTests(unittest.TestCase):
    def setUp(self):
        scratch = PROJECT / 'tests' / '.tmp'
        scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='build script ', dir=scratch)
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.root_patch = patch.object(build, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        (self.root / 'package-lock.json').write_text('{}', encoding='utf-8')
        self.install_files()
        self.commands = []

    def install_files(self):
        for entry in build.REQUIRED_ENTRIES:
            target = self.root / 'node_modules' / entry
            target.parent.mkdir(parents=True, exist_ok=True)
            target.touch()

    def process(self, command, **kwargs):
        self.commands.append((command, kwargs))
        if command[1:2] == ['-p']:
            return subprocess.CompletedProcess(command, 0, stdout='22.20.0\n')
        if command[1:2] == ['ci']:
            self.install_files()
        return subprocess.CompletedProcess(command, 0)

    def invoke(self, args=(), host='windows', process=None, tools=None):
        tools = tools if tools is not None else {'node': 'node', 'npm.cmd': 'npm.cmd', 'npm': 'npm', 'codesign': '/usr/bin/codesign'}
        capture = io.StringIO()
        with patch.object(build, 'host_platform', return_value=host), patch.object(build, 'host_arch', return_value='x64'), \
                patch.object(build.shutil, 'which', side_effect=tools.get), patch.object(build.subprocess, 'run', side_effect=process or self.process), \
                contextlib.redirect_stdout(capture), contextlib.redirect_stderr(capture):
            code = build.main(args)
        return code, capture.getvalue()

    def test_each_native_platform_and_universal(self):
        for host, arch, flag in [('windows', 'arm64', '--win'), ('macos', 'universal', '--mac'), ('linux', 'x64', '--linux')]:
            with self.subTest(host=host):
                self.commands.clear()
                code, output = self.invoke(['--arch', arch, '--no-install'], host=host)
                self.assertEqual(code, 0, output)
                command, kwargs = self.commands[-1]
                self.assertIn(flag, command)
                self.assertIn('--' + arch, command)
                self.assertEqual(command[command.index('--publish') + 1], 'never')
                self.assertIn(str(self.root / 'electron-builder.yml'), command)
                self.assertEqual(kwargs['cwd'], self.root)
                self.assertFalse(kwargs['shell'])
                self.assertEqual(kwargs['env']['CSC_IDENTITY_AUTO_DISCOVERY'], 'false')
                self.assertIn('打包完成', output)

    def test_dry_run_has_no_process_or_filesystem_effects(self):
        code, output = self.invoke(['--dry-run', '--platform', 'macos', '--arch', 'universal', '--output', 'release space', '--dir'])
        self.assertEqual(code, 0, output)
        self.assertEqual(self.commands, [])
        self.assertFalse((self.root / 'release space').exists())
        self.assertIn('--universal', output)
        self.assertIn('--dir', output)
        self.assertIn(str(self.root / 'release space'), output)

    def test_missing_dependencies_install_before_build(self):
        (self.root / 'node_modules' / build.REQUIRED_ENTRIES[0]).unlink()
        code, output = self.invoke()
        self.assertEqual(code, 0, output)
        self.assertEqual(self.commands[1][0], ['npm.cmd', 'ci', '--include=dev'])
        self.assertIn('build-icons.cjs', self.commands[2][0][1])
        self.assertIn('vue-tsc', self.commands[3][0][1])

    def test_no_install_fails_early_when_dependencies_missing(self):
        (self.root / 'node_modules' / build.REQUIRED_ENTRIES[0]).unlink()
        code, output = self.invoke(['--no-install'])
        self.assertEqual(code, 1)
        self.assertIn('开发依赖不完整', output)
        self.assertEqual(self.commands, [])

    def test_install_failure_propagates_exit_code_and_stops(self):
        def fail(command, **kwargs):
            if command[1:2] == ['ci']:
                self.commands.append((command, kwargs))
                return subprocess.CompletedProcess(command, 17)
            return self.process(command, **kwargs)
        code, output = self.invoke(['--install'], process=fail)
        self.assertEqual(code, 17)
        self.assertNotIn('打包完成', output)
        self.assertEqual(len(self.commands), 2)

    def test_build_failure_never_runs_packager(self):
        def fail(command, **kwargs):
            if 'vue-tsc' in command[1]:
                self.commands.append((command, kwargs))
                return subprocess.CompletedProcess(command, 23)
            return self.process(command, **kwargs)
        code, output = self.invoke(process=fail)
        self.assertEqual(code, 23)
        self.assertEqual(len(self.commands), 3)
        self.assertNotIn('打包完成', output)

    def test_icon_failure_never_builds_or_packages(self):
        def fail(command, **kwargs):
            if 'build-icons.cjs' in command[1]:
                self.commands.append((command, kwargs))
                return subprocess.CompletedProcess(command, 19)
            return self.process(command, **kwargs)
        code, output = self.invoke(process=fail)
        self.assertEqual(code, 19)
        self.assertEqual(len(self.commands), 2)
        self.assertNotIn('打包完成', output)

    def test_credentials_are_removed_without_modifying_parent(self):
        original = {
            'PATH': 'tools', 'HTTPS_PROXY': 'proxy', 'CSC_LINK': 'secret', 'WIN_CSC_LINK': 'secret',
            'csc_name': 'secret', 'CSC_IDENTITY_AUTO_DISCOVERY': 'true', 'APPLE_API_KEY': 'secret',
            'APPLE_APP_SPECIFIC_PASSWORD': 'secret', 'ELECTRON_RUN_AS_NODE': '1', 'MD2W_DEVTOOLS': 'right',
        }
        env = build.build_environment(original)
        self.assertNotIn('secret', env.values())
        self.assertEqual(env['CSC_IDENTITY_AUTO_DISCOVERY'], 'false')
        self.assertEqual(env['HTTPS_PROXY'], 'proxy')
        self.assertNotIn('ELECTRON_RUN_AS_NODE', env)
        self.assertEqual(original['CSC_LINK'], 'secret')

    def test_native_host_required_and_universal_is_mac_only(self):
        for args in [['--platform', 'macos'], ['--platform', 'linux'], ['--arch', 'universal']]:
            with self.subTest(args=args):
                code, _ = self.invoke(args)
                self.assertEqual(code, 1)
                self.assertEqual(self.commands, [])

    def test_codesign_required_even_without_certificate(self):
        code, output = self.invoke(host='macos', tools={'node': 'node', 'npm': 'npm'})
        self.assertEqual(code, 1)
        self.assertIn('codesign', output)
        self.assertEqual(len(self.commands), 1)

    def test_old_node_is_rejected(self):
        code, output = self.invoke(process=lambda command, **kwargs: subprocess.CompletedProcess(command, 0, stdout='20.19.0\n'))
        self.assertEqual(code, 1)
        self.assertIn('Node.js 20.19.0', output)

    def test_node_shim_failure_keeps_actionable_diagnostic(self):
        code, output = self.invoke(process=lambda command, **kwargs: subprocess.CompletedProcess(command, 1, stdout='', stderr='No active Node.js version; run nvm use.'))
        self.assertEqual(code, 1)
        self.assertIn('run nvm use', output)
        self.assertNotIn('打包完成', output)

    def test_output_directory_does_not_depend_on_calling_directory(self):
        code, output = self.invoke(['--output', 'dist/test packages', '--dir'])
        self.assertEqual(code, 0, output)
        command = self.commands[-1][0]
        self.assertIn(f'--config.directories.output={self.root / "dist/test packages"}', command)
        self.assertIn('--dir', command)
        self.assertEqual(command[-1], '--dir')

    def test_project_and_parent_are_not_output_directories(self):
        for output in [str(self.root), str(self.root.parent)]:
            with self.subTest(output=output):
                code, _ = self.invoke(['--output', output])
                self.assertEqual(code, 1)
                self.assertEqual(self.commands, [])

    def test_architecture_detection(self):
        for machine, expected in [('AMD64', 'x64'), ('x86_64', 'x64'), ('aarch64', 'arm64'), ('arm64', 'arm64')]:
            with patch.object(build.platform, 'machine', return_value=machine):
                self.assertEqual(build.host_arch(), expected)


if __name__ == '__main__':
    unittest.main()
