#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""md2wechatmp 一键调试启动器。

    python debug.py                 开发模式：热更新 + 自动打开 DevTools + 远程调试端口
    python debug.py preview         构建后以产物启动（调试打包后的真实行为）
    python debug.py check           只做环境体检，不启动任何进程
    python debug.py compile 文件.md  脱离界面直接跑转换管线，看输出与诊断

调试用开关（dev / preview 通用）：

    --port 9222        渲染进程远程调试端口（chrome://inspect 可连）
    --main-port 9229   主进程 V8 调试端口
    --no-inspect       不开放主进程调试端口
    --no-devtools      启动时不自动弹出 DevTools
    --clean            清掉上次未保存的工作副本（验证恢复流程时用）
    --reset            --clean + 清掉设置文件，回到首次启动状态
    --kill             启动前清掉本项目残留的 electron 进程（单实例锁会让新窗口直接退出）
    --log 路径         日志同时落盘，默认 out/debug-<时间>.log
    --timeout 秒       启动后到点自动退出，用于冒烟
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import socket
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IS_WINDOWS = platform.system() == 'Windows'
IS_MACOS = platform.system() == 'Darwin'
APP_NAME = 'md2wechatmp'

# ---------------------------------------------------------------- 终端输出


def _init_console() -> bool:
    """统一按 UTF-8 输出，避免 Windows 默认 GBK 控制台在中文/符号上炸掉。"""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            try:
                stream.reconfigure(encoding='utf-8', errors='replace')
            except Exception:
                pass
    return sys.stdout.isatty() and os.environ.get('NO_COLOR') is None


COLOR = _init_console()


def paint(text: str, code: str) -> str:
    return f'\033[{code}m{text}\033[0m' if COLOR else text


def ok(text: str) -> str:
    return paint(f'✓ {text}', '32')


def bad(text: str) -> str:
    return paint(f'✗ {text}', '31')


def warn(text: str) -> str:
    return paint(f'! {text}', '33')


def dim(text: str) -> str:
    return paint(text, '90')


def head(text: str) -> str:
    return paint(text, '1;36')


def say(text: str = '') -> None:
    print(text, flush=True)


# ---------------------------------------------------------------- 环境探测


def node_bin() -> str | None:
    return shutil.which('node')


def npm_bin() -> str | None:
    return shutil.which('npm') or shutil.which('npm.cmd')


def electron_vite_entry() -> Path:
    return ROOT / 'node_modules' / 'electron-vite' / 'bin' / 'electron-vite.js'


def vite_node_entry() -> Path:
    return ROOT / 'node_modules' / 'vite-node' / 'dist' / 'cli.mjs'


def electron_binary() -> Path:
    base = ROOT / 'node_modules' / 'electron' / 'dist'
    if IS_WINDOWS:
        return base / 'electron.exe'
    if IS_MACOS:
        return base / 'Electron.app' / 'Contents' / 'MacOS' / 'Electron'
    return base / 'electron'


def app_data_dir() -> Path:
    if IS_WINDOWS:
        root = os.environ.get('APPDATA') or str(Path.home() / 'AppData' / 'Roaming')
        return Path(root) / APP_NAME
    if IS_MACOS:
        return Path.home() / 'Library' / 'Application Support' / APP_NAME
    return Path(os.environ.get('XDG_CONFIG_HOME') or Path.home() / '.config') / APP_NAME


def package_version(name: str) -> str | None:
    manifest = ROOT / 'node_modules' / name / 'package.json'
    if not manifest.exists():
        return None
    try:
        import json

        return json.loads(manifest.read_text(encoding='utf-8')).get('version')
    except Exception:
        return None


def port_busy(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.35)
        return sock.connect_ex(('127.0.0.1', port)) == 0


def stale_processes() -> list[tuple[int, str]]:
    """只认本项目目录下的 electron，避免误伤其他 Electron 应用。"""
    try:
        if IS_WINDOWS:
            query = (
                "Get-CimInstance Win32_Process -Filter \"Name='electron.exe' or Name='md2wechatmp.exe'\" "
                f"| Where-Object {{ $_.ExecutablePath -and $_.ExecutablePath -like '*{APP_NAME}*' }} "
                '| ForEach-Object { "$($_.ProcessId)`t$($_.ExecutablePath)" }'
            )
            out = subprocess.run(
                ['powershell', '-NoProfile', '-NonInteractive', '-Command', query],
                capture_output=True,
                text=True,
                timeout=20,
            ).stdout
        else:
            out = subprocess.run(
                ['pgrep', '-fl', f'{APP_NAME}|node_modules/electron/dist'],
                capture_output=True,
                text=True,
                timeout=10,
            ).stdout
    except Exception:
        return []

    found: list[tuple[int, str]] = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        if IS_WINDOWS:
            pid_text, _, path = line.partition('\t')
        else:
            pid_text, _, path = line.partition(' ')
        normalized = path.replace('\\', '/').lower()
        if str(ROOT).replace('\\', '/').lower() not in normalized and APP_NAME not in normalized:
            continue
        try:
            found.append((int(pid_text.strip()), path.strip()))
        except ValueError:
            continue
    return found


def kill_stale() -> int:
    killed = 0
    for pid, _ in stale_processes():
        try:
            if IS_WINDOWS:
                subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)], capture_output=True, timeout=15)
            else:
                os.kill(pid, 9)
            killed += 1
        except Exception:
            pass
    return killed


# ---------------------------------------------------------------- 清理


def clean_state(workcopies: bool, settings: bool) -> None:
    data = app_data_dir()
    if workcopies:
        target = data / 'workcopies'
        if target.exists():
            for item in target.glob('*'):
                try:
                    item.unlink()
                except Exception:
                    pass
            say(f'  {ok("已清理工作副本")} {dim(str(target))}')
        else:
            say(f'  {dim("没有工作副本")} {dim(str(target))}')
    if settings:
        target = data / 'settings.json'
        if target.exists():
            try:
                target.unlink()
                say(f'  {ok("已重置设置")} {dim(str(target))}')
            except Exception as error:
                say(f'  {warn(f"设置文件删除失败：{error}")}')
        else:
            say(f'  {dim("没有设置文件")} {dim(str(target))}')


# ---------------------------------------------------------------- 进程管理


def child_env(devtools: bool, devtools_mode: str, announce: bool = True) -> dict[str, str]:
    env = dict(os.environ)
    dropped = []

    # Windows 上这两个变量会让 Electron 退化成纯 Node，界面根本起不来。
    for key in ('ELECTRON_RUN_AS_NODE',):
        if key in env:
            env.pop(key)
            dropped.append(key)

    env['ELECTRON_ENABLE_LOGGING'] = '1'
    if devtools:
        env['MD2W_DEVTOOLS'] = devtools_mode
    else:
        env.pop('MD2W_DEVTOOLS', None)

    if dropped and announce:
        say(f'  {warn("已临时移除环境变量 " + "、".join(dropped) + "（否则 Electron 会退化成纯 Node）")}')
    return env


def terminate_tree(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    try:
        if IS_WINDOWS:
            subprocess.run(
                ['taskkill', '/F', '/T', '/PID', str(proc.pid)],
                capture_output=True,
                timeout=20,
            )
        else:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
    except Exception:
        pass


def run(cmd: list[str], env: dict[str, str], log_path: Path, title: str) -> int:
    global STOPPED_BY_TIMEOUT
    say(dim('  $ ' + ' '.join(cmd)))

    proc = subprocess.Popen(
        cmd,
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        bufsize=1,
    )

    timer = None
    if ARGS.timeout:
        def _stop() -> None:
            global STOPPED_BY_TIMEOUT
            STOPPED_BY_TIMEOUT = True
            say(warn(f'达到 --timeout {ARGS.timeout}s，结束进程。'))
            terminate_tree(proc)

        timer = threading.Timer(ARGS.timeout, _stop)
        timer.daemon = True
        timer.start()

    assert proc.stdout is not None
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, 'a', encoding='utf-8') as log:
        log.write(f'\n===== {title} @ {datetime.now():%Y-%m-%d %H:%M:%S} =====\n')
        try:
            for line in proc.stdout:
                sys.stdout.write(line)
                sys.stdout.flush()
                log.write(line)
        except KeyboardInterrupt:
            say('')
            say(warn('收到中断，正在关闭…'))
            terminate_tree(proc)
        finally:
            if timer:
                timer.cancel()
            try:
                code = proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                terminate_tree(proc)
                code = proc.wait(timeout=10)
    return code if code is not None else 0


# ---------------------------------------------------------------- 各模式


def preflight() -> bool:
    problems: list[str] = []

    if not node_bin():
        problems.append('找不到 node，请先安装 Node.js ≥ 22 并加入 PATH。')
    if not (ROOT / 'node_modules').is_dir():
        problems.append('依赖未安装：在项目目录执行 npm install。')
    elif not electron_vite_entry().exists():
        problems.append('缺少 electron-vite：执行 npm install。')
    if not electron_binary().exists():
        problems.append(
            'Electron 二进制缺失：执行 npm run electron:install（默认使用国内镜像）。'
            'Electron 42+ 不再随 npm install 自动下载，项目 postinstall 会补齐；'
            '若安装时跳过了脚本，请手动执行上述命令。'
        )

    for item in problems:
        say(f'  {bad(item)}')
    return not problems


def guard_ports(port: int, main_port: int, inspect: bool) -> None:
    targets = [('渲染调试端口', port)]
    if inspect:
        targets.append(('主进程调试端口', main_port))
    for label, value in targets:
        if value and port_busy(value):
            say(f'  {warn(f"{label} {value} 已被占用，DevTools 可能连到别的进程；可用 --port / --main-port 换一个。")}')


def banner(mode: str, port: int, main_port: int, inspect: bool, log_path: Path) -> None:
    say('')
    say(head(f'md2wechatmp 调试启动 · {mode}'))
    say(f'  项目目录   {dim(str(ROOT))}')
    say(f'  渲染调试   {dim(f"http://127.0.0.1:{port}")}  →  chrome://inspect 可连')
    if inspect:
        say(f'  主进程     {dim(f"127.0.0.1:{main_port}")}  →  chrome://inspect → Configure 添加该地址')
    say(f'  日志文件   {dim(str(log_path))}')
    say(dim('  Ctrl+C 结束；关掉应用窗口也会一并退出。'))
    say('')


def cmd_dev(port: int, main_port: int, inspect: bool, sourcemap: bool, devtools: bool) -> int:
    node = node_bin()
    if not node:
        return 1

    cmd = [node, str(electron_vite_entry()), 'dev']
    if sourcemap:
        cmd.append('--sourcemap')
    if inspect:
        cmd.extend(['--inspect', str(main_port)])
    if port:
        cmd.extend(['--remoteDebuggingPort', str(port)])

    log_path = resolve_log()
    banner('开发模式（热更新）', port, main_port, inspect, log_path)
    env = child_env(devtools, 'detach')
    return run(cmd, env, log_path, 'dev')


def cmd_preview(port: int, main_port: int, inspect: bool, devtools: bool) -> int:
    node = node_bin()
    electron = electron_binary()
    if not node or not electron.exists():
        return 1

    log_path = resolve_log()
    env = child_env(devtools, 'detach')

    if not ARGS.no_build:
        say(head('先构建产物'))
        code = run([node, str(electron_vite_entry()), 'build'], env, log_path, 'build')
        if code != 0:
            say(bad(f'构建失败（退出码 {code}），已停止。'))
            return code
    elif not (ROOT / 'out' / 'main' / 'index.js').exists():
        say(bad('没有可用的 out/ 产物，去掉 --no-build 重新构建。'))
        return 1

    cmd = [str(electron), '.']
    if port:
        cmd.append(f'--remote-debugging-port={port}')
    if inspect:
        cmd.append(f'--inspect={main_port}')

    banner('产物预览（打包后行为）', port, main_port, inspect, log_path)
    return run(cmd, env, log_path, 'preview')


def cmd_compile(target: str, theme: str) -> int:
    node = node_bin()
    if not node:
        return 1
    entry = vite_node_entry()
    if not entry.exists():
        say(bad('缺少 vite-node：执行 npm install。'))
        return 1

    fixture = Path(target)
    if not fixture.is_absolute():
        fixture = (ROOT / target).resolve()
    if not fixture.exists():
        say(bad(f'找不到文件：{fixture}'))
        return 1

    log_path = resolve_log()
    say(head('直接跑转换管线'))
    say(f'  源文件   {dim(str(fixture))}')
    say(f'  主题     {dim(theme)}')
    say('')
    return run(
        [node, str(entry), 'scripts/compile-fixture.mts', str(fixture), theme],
        child_env(False, 'detach', announce=False),
        log_path,
        'compile',
    )


def cmd_check(port: int, main_port: int, inspect: bool) -> int:
    say(head('环境体检'))

    rows: list[tuple[bool, str, str]] = []

    py = platform.python_version()
    rows.append((sys.version_info >= (3, 9), 'Python', py))

    node = node_bin()
    rows.append((bool(node), 'Node', node or '未找到'))

    npm = npm_bin()
    rows.append((bool(npm), 'npm', npm or '未找到'))

    ev = package_version('electron-vite')
    rows.append((bool(ev), 'electron-vite', ev or '未安装'))

    ec = package_version('electron')
    rows.append((bool(ec), 'electron 包', ec or '未安装'))

    binary = electron_binary()
    rows.append((binary.exists(), 'Electron 二进制', str(binary) if binary.exists() else '缺失，执行 npm run electron:install'))

    vn = package_version('vite-node')
    rows.append((bool(vn), 'vite-node', vn or '未安装（compile 模式不可用）'))

    modules = (ROOT / 'node_modules').is_dir()
    rows.append((modules, '依赖目录', 'node_modules 已就绪' if modules else '缺少 node_modules'))

    built = (ROOT / 'out' / 'main' / 'index.js').exists()
    rows.append((True, '构建产物', 'out/ 已存在' if built else '尚无 out/（首次 dev 会自动构建）'))

    width = max(len(name) for _, name, _ in rows)
    for passed, name, value in rows:
        label = name.ljust(width)
        mark = paint('✓ ' + label, '32') if passed else paint('✗ ' + label, '31')
        say(f'  {mark}  {dim(value)}')

    say('')
    say(head('端口与残留进程'))
    for label, value, enabled in (
        ('渲染调试端口', port, True),
        ('主进程调试端口', main_port, inspect),
    ):
        if not enabled:
            continue
        busy = port_busy(value)
        say(f'  {label} {value}  {"占用中（可换端口）" if busy else "空闲"}')

    stale = stale_processes()
    if stale:
        say(f'  {warn(f"发现 {len(stale)} 个本项目残留进程")}')
        for pid, path in stale:
            say(f'    {dim(str(pid))}  {dim(path)}')
        say(f'  {dim("用 --kill 清掉，否则单实例锁会让新窗口启动后立刻退出。")}')
    else:
        say(f'  没有残留进程')

    say('')
    say(head('应用数据'))
    data = app_data_dir()
    say(f'  目录       {dim(str(data))}')
    workcopies = list((data / 'workcopies').glob('*')) if (data / 'workcopies').is_dir() else []
    say(f'  工作副本   {len(workcopies)} 个')
    settings = data / 'settings.json'
    say(f'  设置文件   {"存在" if settings.exists() else "尚未生成"}')

    failures = [name for passed, name, _ in rows if not passed]
    say('')
    if failures:
        say(warn(f'有 {len(failures)} 项需要处理：' + '、'.join(failures)))
        return 1
    say(ok('环境就绪，可以直接 python debug.py 启动。'))
    return 0


# ---------------------------------------------------------------- 入口


def resolve_log() -> Path:
    global LOG_PATH
    if LOG_PATH is None:
        if ARGS.log:
            path = Path(ARGS.log)
            LOG_PATH = path if path.is_absolute() else (ROOT / path)
        else:
            stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            LOG_PATH = ROOT / 'out' / f'debug-{stamp}.log'
    return LOG_PATH


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog='debug.py',
        description='md2wechatmp 一键调试启动器',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            '示例：\n'
            '  python debug.py\n'
            '  python debug.py preview --clean\n'
            '  python debug.py check\n'
            '  python debug.py compile tests/fixtures/b300-backpay.md --theme jade\n'
        ),
    )
    parser.add_argument('mode', nargs='?', default='dev', choices=['dev', 'preview', 'check', 'compile'],
                        help='dev（默认）/ preview / check / compile')
    parser.add_argument('target', nargs='?', help='compile 模式下的 Markdown 路径')

    parser.add_argument('--theme', default='ocean-blue', help='compile 模式的主题，默认 ocean-blue')
    parser.add_argument('--port', type=int, default=9222, help='渲染进程远程调试端口，默认 9222')
    parser.add_argument('--main-port', type=int, default=9229, help='主进程调试端口，默认 9229')
    parser.add_argument('--no-inspect', action='store_true', help='不开放主进程调试端口')
    parser.add_argument('--no-devtools', action='store_true', help='启动时不自动打开 DevTools')
    parser.add_argument('--no-sourcemap', action='store_true', help='dev 构建不带 sourcemap')
    parser.add_argument('--no-build', action='store_true', help='preview 模式跳过构建')
    parser.add_argument('--clean', action='store_true', help='清掉工作副本')
    parser.add_argument('--reset', action='store_true', help='清掉工作副本与设置文件')
    parser.add_argument('--kill', action='store_true', help='启动前清理本项目残留进程')
    parser.add_argument('--log', help='日志路径，默认 out/debug-<时间>.log')
    parser.add_argument('--timeout', type=int, default=0, help='启动后 N 秒自动退出（冒烟用）')
    return parser


def main() -> int:
    global ARGS
    ARGS = build_parser().parse_args()

    if ARGS.mode == 'compile' and not ARGS.target:
        say(bad('compile 模式需要给出 Markdown 路径，例如：python debug.py compile tests/fixtures/b300-backpay.md'))
        return 2

    inspect = not ARGS.no_inspect

    say(head(f'md2wechatmp · {datetime.now():%Y-%m-%d %H:%M}'))

    if ARGS.mode == 'check':
        return cmd_check(ARGS.port, ARGS.main_port, inspect)

    if ARGS.kill:
        killed = kill_stale()
        say(f'  {ok(f"已结束 {killed} 个残留进程") if killed else dim("没有需要清理的进程")}')

    if ARGS.clean or ARGS.reset:
        clean_state(workcopies=True, settings=ARGS.reset)

    if ARGS.mode == 'compile':
        return cmd_compile(ARGS.target, ARGS.theme)

    if not preflight():
        say('')
        say(bad('环境未就绪，已停止启动。'))
        return 1

    guard_ports(ARGS.port, ARGS.main_port, inspect)

    devtools = not ARGS.no_devtools
    if ARGS.mode == 'preview':
        code = cmd_preview(ARGS.port, ARGS.main_port, inspect, devtools)
    else:
        code = cmd_dev(ARGS.port, ARGS.main_port, inspect, not ARGS.no_sourcemap, devtools)

    say('')
    if STOPPED_BY_TIMEOUT:
        say(ok('已按 --timeout 结束。'))
        return 0
    if code == 0:
        say(ok('已正常退出。'))
    else:
        say(warn(f'异常退出（退出码 {code}），日志：{resolve_log()}'))
    return code


ARGS: argparse.Namespace
LOG_PATH: Path | None = None
STOPPED_BY_TIMEOUT = False


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        say('')
        say('已退出。')
        sys.exit(130)
