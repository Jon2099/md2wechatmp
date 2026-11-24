#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一键构建当前系统的安装包；macOS 仅作 ad-hoc 空签名。

    python build.py                       自动识别当前系统与架构
    python build.py --arch arm64          打包 ARM64 版本
    python build.py --arch universal      macOS Intel + Apple Silicon 通用包
    python build.py --dir                 只生成应用目录，不生成安装包
    python build.py --dry-run             打印计划，不安装或构建

仅依赖 Python 标准库。需要 Node.js >= 22；首次使用会自动安装开发依赖。
请在 Windows / macOS / Linux 对应系统执行，不在本脚本内进行跨系统编译。
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Mapping, Sequence

ROOT = Path(__file__).resolve().parent
PLATFORMS = {'Windows': 'windows', 'Darwin': 'macos', 'Linux': 'linux'}
BUILDER_FLAGS = {'windows': '--win', 'macos': '--mac', 'linux': '--linux'}
FORMATS = {'windows': 'NSIS EXE', 'macos': 'DMG + ZIP', 'linux': 'DEB'}
APPLE_SIGNING_ENV = {
    'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID', 'APPLE_API_KEY',
    'APPLE_API_KEY_ID', 'APPLE_API_ISSUER', 'APPLE_KEYCHAIN', 'APPLE_KEYCHAIN_PROFILE',
}
REQUIRED_ENTRIES = (
    'electron-builder/cli.js', 'electron-vite/bin/electron-vite.js',
    'vue-tsc/bin/vue-tsc.js', 'electron/package.json',
    '@resvg/resvg-wasm/index.js', '@resvg/resvg-wasm/index_bg.wasm', 'pngjs/lib/png.js',
)


class BuildError(Exception):
    """预检失败，或构建工具返回失败。"""

    def __init__(self, message: str, code: int = 1):
        super().__init__(message)
        self.code = code


def host_platform() -> str:
    name = platform.system()
    if name not in PLATFORMS:
        raise BuildError(f'不支持的系统：{name}；支持 Windows、macOS 和 Linux。')
    return PLATFORMS[name]


def host_arch() -> str:
    machine = platform.machine().lower()
    if machine in ('amd64', 'x86_64', 'x64'):
        return 'x64'
    if machine in ('arm64', 'aarch64'):
        return 'arm64'
    raise BuildError(f'无法自动识别架构 {machine}，请指定 --arch x64 或 --arch arm64。')


def build_environment(source: Mapping[str, str]) -> dict[str, str]:
    """只清理子进程环境，不改动用户配置，也不输出证书或密码。"""
    env = {
        key: value for key, value in source.items()
        if not key.upper().startswith(('CSC_', 'WIN_CSC_'))
        and key.upper() not in APPLE_SIGNING_ENV
        and key.upper() not in {'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'MD2W_DEVTOOLS'}
    }
    env['CSC_IDENTITY_AUTO_DISCOVERY'] = 'false'
    return env


def build_command(node: str, target: str, arch: str, output: Path, directory_only: bool) -> list[str]:
    command = [
        node, str(ROOT / 'node_modules/electron-builder/cli.js'),
        BUILDER_FLAGS[target], f'--{arch}', '--publish', 'never',
        '--config', str(ROOT / 'electron-builder.yml'),
        f'--config.directories.output={output}',
    ]
    if directory_only:
        command.append('--dir')
    return command


def display_command(command: Sequence[str]) -> str:
    # 仅用于显示；实际执行始终用参数数组和 shell=False。
    return subprocess.list2cmdline(list(command))


def run(command: Sequence[str], env: Mapping[str, str]) -> None:
    print(f'\n> {display_command(command)}', flush=True)
    result = subprocess.run(list(command), cwd=ROOT, env=dict(env), shell=False, check=False)
    if result.returncode:
        raise BuildError(f'命令执行失败，退出码 {result.returncode}。', result.returncode if result.returncode > 0 else 1)


def check_node(node: str, env: Mapping[str, str]) -> None:
    result = subprocess.run(
        [node, '-p', 'process.versions.node'], cwd=ROOT, env=dict(env),
        capture_output=True, text=True, encoding='utf-8', errors='replace', check=False,
    )
    if result.returncode:
        detail = (result.stderr or result.stdout or '').strip()
        message = 'Node.js 无法启动，请检查安装、nvm 版本选择和 PATH。'
        raise BuildError(f'{message}\n{detail}' if detail else message)
    version = result.stdout.strip()
    try:
        major = int(version.split('.')[0])
    except ValueError as error:
        raise BuildError('无法读取 Node.js 版本。') from error
    if major < 22:
        raise BuildError(f'当前 Node.js {version}，请安装 Node.js 22 或更新版本。')


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--platform', choices=('auto', 'windows', 'macos', 'linux'), default='auto', help='目标系统，默认当前系统')
    parser.add_argument('--arch', choices=('x64', 'arm64', 'universal'), help='目标架构，默认当前 CPU；universal 仅限 macOS')
    parser.add_argument('--dir', action='store_true', help='只打包应用目录')
    parser.add_argument('--output', default='dist', help='输出目录，默认项目下 dist；相对路径以项目目录为基准')
    parser.add_argument('--dry-run', action='store_true', help='仅显示计划，不安装依赖、不构建、不生成文件')
    install = parser.add_mutually_exclusive_group()
    install.add_argument('--install', action='store_true', help='构建前重新安装锁文件中的依赖')
    install.add_argument('--no-install', action='store_true', help='禁止自动安装 npm 依赖，要求依赖已准备完整')
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        host = host_platform()
        target = host if args.platform == 'auto' else args.platform
        arch = args.arch or host_arch()
        if arch == 'universal' and target != 'macos':
            raise BuildError('--arch universal 仅适用于 macOS。')
        if target != host and not args.dry_run:
            raise BuildError(f'当前系统为 {host}，请在 {target} 系统运行此脚本。macOS 空签名必须使用 macOS 的 codesign。')
        output = (ROOT / args.output).resolve()
        if output == ROOT or output in ROOT.parents:
            raise BuildError('输出目录不能是项目根目录或其父目录，请使用 dist 等独立目录。')
        if output.exists() and not output.is_dir():
            raise BuildError('输出路径已存在且不是目录。')

        node = shutil.which('node')
        if not node:
            raise BuildError('找不到 Node.js，请安装 Node.js 22 或更新版本并加入 PATH。')
        npm = shutil.which('npm.cmd') if host == 'windows' else shutil.which('npm')
        env = build_environment(os.environ)
        missing = [name for name in REQUIRED_ENTRIES if not (ROOT / 'node_modules' / name).is_file()]
        install_needed = args.install or bool(missing)
        if install_needed and args.no_install:
            raise BuildError('开发依赖不完整；请先运行 npm ci --include=dev，或去掉 --no-install。')
        if not (ROOT / 'package-lock.json').is_file():
            raise BuildError('缺少 package-lock.json，无法按锁文件安装依赖。')

        command = build_command(node, target, arch, output, args.dir)
        print(f'目标：{target} / {arch}', flush=True)
        print(f'产物：{"应用目录" if args.dir else FORMATS[target]}', flush=True)
        print('签名：macOS ad-hoc 空签名；Windows / Linux 不签名；不公证、不发布。', flush=True)
        print(f'输出：{output}', flush=True)
        if install_needed and not npm:
            raise BuildError('找不到 npm，无法安装依赖，请检查 Node.js 安装。')

        if args.dry_run:
            if install_needed:
                print(f'计划：{display_command([npm, "ci", "--include=dev"])}')
            print(f'计划：{display_command([node, str(ROOT / "scripts/build-icons.cjs")])}')
            print(f'计划：{display_command([node, str(ROOT / "node_modules/vue-tsc/bin/vue-tsc.js"), "--noEmit", "-p", "tsconfig.json"])}')
            print(f'计划：{display_command([node, str(ROOT / "node_modules/electron-vite/bin/electron-vite.js"), "build"])}')
            print(f'计划：{display_command(command)}')
            return 0

        check_node(node, env)
        if target == 'macos' and not shutil.which('codesign'):
            raise BuildError('macOS 空签名需要 codesign，请先安装 Xcode Command Line Tools（xcode-select --install）。')
        if install_needed:
            run([npm, 'ci', '--include=dev'], env)
        if any(not (ROOT / 'node_modules' / name).is_file() for name in REQUIRED_ENTRIES):
            raise BuildError('依赖安装后仍不完整，请检查 npm 安装输出。')

        run([node, str(ROOT / 'scripts/build-icons.cjs')], env)
        run([node, str(ROOT / 'node_modules/vue-tsc/bin/vue-tsc.js'), '--noEmit', '-p', 'tsconfig.json'], env)
        run([node, str(ROOT / 'node_modules/electron-vite/bin/electron-vite.js'), 'build'], env)
        run(command, env)
        print(f'\n打包完成：{output}', flush=True)
        return 0
    except BuildError as error:
        print(f'\n打包失败：{error}', file=sys.stderr, flush=True)
        return error.code
    except OSError as error:
        print(f'\n无法执行构建工具：{error}', file=sys.stderr, flush=True)
        return 1
    except KeyboardInterrupt:
        print('\n已取消打包。', file=sys.stderr, flush=True)
        return 130


if __name__ == '__main__':
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='replace')
    sys.exit(main())
