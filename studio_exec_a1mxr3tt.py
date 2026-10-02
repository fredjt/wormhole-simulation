import subprocess, os

# Set identity for all operations
env = {
    'GIT_AUTHOR_NAME': 'Trent Tanchin',
    'GIT_AUTHOR_EMAIL': 'fredjt@users.noreply.github.com',
    'GIT_COMMITTER_NAME': 'Trent Tanchin',
    'GIT_COMMITTER_EMAIL': 'fredjt@users.noreply.github.com',
}

# Commit 1: Initial single-file version
subprocess.run(['git', 'add', '-A'], env=env, capture_output=True)
result = subprocess.run([
    'git', 'commit', '-m', 
    'Initial: Wormhole simulation with Kerr metric, EOS calibration, and 3D visualization\n'
    '\n'
    '- Generalized lapse function for arbitrary mass, spin, and charge\n'
    '- Effective potential well model with proper boundary conditions\n'
    '- EOS (equation of state) calibration at a0\n'
    '- RK4 integration with adaptive sub-stepping\n'
    '- Three.js 3D shell visualization with proper rendering loop\n'
    '- Real-time parameter control with sliders\n'
    '- Phase space and time-series plots\n'
    '- Horizon crossing detection and coordinate transformation'
], env=env, capture_output=True, text=True)
print("Commit 1:", result.stdout.strip())
