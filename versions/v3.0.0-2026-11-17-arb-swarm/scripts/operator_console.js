const { execSync } = require('child_process');
const readline = require('readline');

function renderConsole() {
    console.clear();
    console.log('=======================================================================');
    console.log('CHRONOS OS: SOVEREIGN OPERATOR CONSOLE v12.0 (POLICY P0)');
    console.log('=======================================================================');
    try {
        const pm2List = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' }));
        pm2List.forEach(proc => {
            const status = proc.pm2_env.status === 'online' ? '[●]' : '[×]';
            const cpu = proc.monit.cpu;
            const ram = (proc.monit.memory / 1024 / 1024).toFixed(1);
            console.log(`  ${status} ${proc.name.padEnd(30)} | Status: ${proc.pm2_env.status.padEnd(8)} | CPU: ${cpu}% | RAM: ${ram} MB`);
        });
    } catch (e) {
        console.log('  ⚠️ PM2 telemetry unavailable or daemon offline.');
    }
    console.log('-----------------------------------------------------------------------');
    console.log(' [Q] Quit Console   [R] Refresh Telemetry   [M] Trigger Manual Scan');
    console.log('=======================================================================');
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function promptUser() {
    renderConsole();
    rl.question('\nChronos-UI > ', (answer) => {
        const cmd = answer.trim().toLowerCase();
        if (cmd === 'q') {
            console.log('Exiting Chronos Operator Console. Daemons continue running under PM2.');
            rl.close();
            process.exit(0);
        } else {
            promptUser();
        }
    });
}

promptUser();
