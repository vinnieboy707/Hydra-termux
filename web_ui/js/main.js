// Protocol configurations and variations
const protocolConfigs = {
    ssh: {
        name: 'SSH',
        icon: '🔐',
        description: 'Secure Shell Protocol - Remote server access',
        variations: [
            {
                name: 'Basic SSH Attack',
                description: 'Standard SSH brute-force attack with common credentials',
                script: 'ssh_admin_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'Target IP/Hostname',
                        type: 'text',
                        required: true,
                        example: '192.168.1.100 or example.com',
                        help: 'The IP address or hostname of the SSH server you want to test',
                        resource: {
                            text: 'How to find IP addresses',
                            url: 'https://www.wikihow.com/Find-a-Server-IP-Address'
                        }
                    },
                    {
                        name: 'port',
                        label: 'Port',
                        type: 'number',
                        required: false,
                        default: '22',
                        example: '22 (default) or 2222',
                        help: 'SSH port number. Default is 22, but some servers use custom ports',
                        resource: {
                            text: 'Common SSH ports',
                            url: 'https://www.ssh.com/academy/ssh/port'
                        }
                    },
                    {
                        name: 'username',
                        label: 'Username (optional)',
                        type: 'text',
                        required: false,
                        example: 'root, admin, user',
                        help: 'Specific username to test. Leave empty to try common usernames',
                        resource: {
                            text: 'Common admin usernames',
                            url: 'https://github.com/danielmiessler/SecLists/tree/master/Usernames'
                        }
                    },
                    {
                        name: 'wordlist',
                        label: 'Password Wordlist (optional)',
                        type: 'text',
                        required: false,
                        example: '/path/to/wordlist.txt',
                        help: 'Path to custom password wordlist. Leave empty for default',
                        resource: {
                            text: 'Download wordlists',
                            url: 'https://github.com/danielmiessler/SecLists'
                        }
                    },
                    {
                        name: 'threads',
                        label: 'Threads',
                        type: 'number',
                        required: false,
                        default: '16',
                        example: '8, 16, or 32',
                        help: 'Number of parallel connections. Higher = faster but more detectable',
                        resource: {
                            text: 'Understanding threads',
                            url: 'https://nmap.org/book/performance-timing-templates.html'
                        }
                    }
                ]
            },
            {
                name: 'SSH Subnet Scan',
                description: 'Scan an entire subnet for SSH servers',
                script: 'ssh_admin_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'Target Subnet (CIDR)',
                        type: 'text',
                        required: true,
                        example: '192.168.1.0/24',
                        help: 'Network range in CIDR notation to scan for SSH servers',
                        resource: {
                            text: 'CIDR notation guide',
                            url: 'https://www.ipaddressguide.com/cidr'
                        }
                    },
                    {
                        name: 'threads',
                        label: 'Threads',
                        type: 'number',
                        required: false,
                        default: '16',
                        example: '8 or 16',
                        help: 'Parallel connections for faster scanning'
                    }
                ]
            }
        ]
    },
    ftp: {
        name: 'FTP',
        icon: '📁',
        description: 'File Transfer Protocol - File server access',
        variations: [
            {
                name: 'Basic FTP Attack',
                description: 'Standard FTP brute-force attack',
                script: 'ftp_admin_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'Target IP/Hostname',
                        type: 'text',
                        required: true,
                        example: '192.168.1.100 or ftp.example.com',
                        help: 'The IP address or hostname of the FTP server',
                        resource: {
                            text: 'How to find FTP servers',
                            url: 'https://www.netspot.com/how-to-find-ftp-server.html'
                        }
                    },
                    {
                        name: 'port',
                        label: 'Port',
                        type: 'number',
                        required: false,
                        default: '21',
                        example: '21 (default)',
                        help: 'FTP port number. Standard is 21',
                        resource: {
                            text: 'FTP port information',
                            url: 'https://www.goanywhere.com/blog/what-is-an-ftp-port'
                        }
                    },
                    {
                        name: 'wordlist',
                        label: 'Password Wordlist (optional)',
                        type: 'text',
                        required: false,
                        example: '/path/to/wordlist.txt',
                        help: 'Path to custom password wordlist'
                    }
                ]
            }
        ]
    },
    web: {
        name: 'Web/HTTP',
        icon: '🌐',
        description: 'HTTP/HTTPS Admin Panels',
        variations: [
            {
                name: 'HTTP Basic Auth',
                description: 'Attack HTTP Basic Authentication',
                script: 'web_admin_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'Target URL',
                        type: 'text',
                        required: true,
                        example: 'http://example.com or https://192.168.1.100',
                        help: 'Full URL of the website or admin panel',
                        resource: {
                            text: 'Finding admin panels',
                            url: 'https://github.com/awesome-security/directory-bruteforce-wordlists'
                        }
                    },
                    {
                        name: 'path',
                        label: 'Admin Path',
                        type: 'text',
                        required: false,
                        default: '/admin',
                        example: '/admin, /login, /wp-admin',
                        help: 'Path to the admin login page',
                        resource: {
                            text: 'Common admin paths',
                            url: 'https://github.com/danielmiessler/SecLists/tree/master/Discovery/Web-Content'
                        }
                    },
                    {
                        name: 'method',
                        label: 'HTTP Method',
                        type: 'select',
                        options: ['GET', 'POST'],
                        required: false,
                        default: 'POST',
                        help: 'HTTP method used by the login form'
                    }
                ]
            },
            {
                name: 'WordPress Login',
                description: 'WordPress wp-login.php brute-force',
                script: 'web_admin_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'WordPress URL',
                        type: 'text',
                        required: true,
                        example: 'https://example.com',
                        help: 'Base URL of WordPress site',
                        resource: {
                            text: 'WordPress security',
                            url: 'https://wordpress.org/support/article/hardening-wordpress/'
                        }
                    },
                    {
                        name: 'username',
                        label: 'Username',
                        type: 'text',
                        required: false,
                        default: 'admin',
                        example: 'admin, administrator',
                        help: 'WordPress username to test'
                    }
                ]
            }
        ]
    },
    rdp: {
        name: 'RDP',
        icon: '🖥️',
        description: 'Remote Desktop Protocol - Windows remote access',
        variations: [
            {
                name: 'Basic RDP Attack',
                description: 'Windows Remote Desktop brute-force',
                script: 'rdp_admin_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'Target IP/Hostname',
                        type: 'text',
                        required: true,
                        example: '192.168.1.100',
                        help: 'IP or hostname of Windows server',
                        resource: {
                            text: 'RDP security guide',
                            url: 'https://docs.microsoft.com/en-us/windows-server/remote/remote-desktop-services/clients/remote-desktop-allow-access'
                        }
                    },
                    {
                        name: 'port',
                        label: 'Port',
                        type: 'number',
                        required: false,
                        default: '3389',
                        example: '3389 (default)',
                        help: 'RDP port number'
                    },
                    {
                        name: 'domain',
                        label: 'Domain (optional)',
                        type: 'text',
                        required: false,
                        example: 'WORKGROUP or DOMAIN',
                        help: 'Windows domain name if applicable',
                        resource: {
                            text: 'Windows domains',
                            url: 'https://docs.microsoft.com/en-us/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview'
                        }
                    }
                ]
            }
        ]
    },
    mysql: {
        name: 'MySQL',
        icon: '🗄️',
        description: 'MySQL Database Server',
        variations: [
            {
                name: 'Basic MySQL Attack',
                description: 'MySQL database brute-force',
                script: 'mysql_admin_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'Target IP/Hostname',
                        type: 'text',
                        required: true,
                        example: '192.168.1.100 or mysql.example.com',
                        help: 'MySQL server address',
                        resource: {
                            text: 'MySQL documentation',
                            url: 'https://dev.mysql.com/doc/refman/8.0/en/connecting.html'
                        }
                    },
                    {
                        name: 'port',
                        label: 'Port',
                        type: 'number',
                        required: false,
                        default: '3306',
                        example: '3306 (default)',
                        help: 'MySQL port number'
                    },
                    {
                        name: 'username',
                        label: 'Username (optional)',
                        type: 'text',
                        required: false,
                        example: 'root, admin, mysql',
                        help: 'Database username to test',
                        resource: {
                            text: 'MySQL users',
                            url: 'https://dev.mysql.com/doc/refman/8.0/en/user-names.html'
                        }
                    }
                ]
            }
        ]
    },
    postgres: {
        name: 'PostgreSQL',
        icon: '🐘',
        description: 'PostgreSQL Database Server',
        variations: [
            {
                name: 'Basic PostgreSQL Attack',
                description: 'PostgreSQL database brute-force',
                script: 'postgres_admin_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'Target IP/Hostname',
                        type: 'text',
                        required: true,
                        example: '192.168.1.100',
                        help: 'PostgreSQL server address',
                        resource: {
                            text: 'PostgreSQL docs',
                            url: 'https://www.postgresql.org/docs/current/auth-methods.html'
                        }
                    },
                    {
                        name: 'port',
                        label: 'Port',
                        type: 'number',
                        required: false,
                        default: '5432',
                        example: '5432 (default)',
                        help: 'PostgreSQL port number'
                    },
                    {
                        name: 'database',
                        label: 'Database Name (optional)',
                        type: 'text',
                        required: false,
                        example: 'postgres, template1',
                        help: 'Specific database to connect to'
                    }
                ]
            }
        ]
    },
    smb: {
        name: 'SMB',
        icon: '🗂️',
        description: 'Server Message Block - Windows file sharing',
        variations: [
            {
                name: 'Basic SMB Attack',
                description: 'Windows SMB/CIFS brute-force',
                script: 'smb_admin_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'Target IP/Hostname',
                        type: 'text',
                        required: true,
                        example: '192.168.1.100',
                        help: 'Windows server with SMB enabled',
                        resource: {
                            text: 'SMB protocol info',
                            url: 'https://docs.microsoft.com/en-us/windows/win32/fileio/microsoft-smb-protocol-and-cifs-protocol-overview'
                        }
                    },
                    {
                        name: 'port',
                        label: 'Port',
                        type: 'number',
                        required: false,
                        default: '445',
                        example: '445 (default) or 139',
                        help: 'SMB port number'
                    },
                    {
                        name: 'domain',
                        label: 'Domain (optional)',
                        type: 'text',
                        required: false,
                        example: 'WORKGROUP',
                        help: 'Windows domain or workgroup name'
                    }
                ]
            }
        ]
    },
    auto: {
        name: 'Auto Attack',
        icon: '⚡',
        description: 'Multi-Protocol Automated Attack',
        variations: [
            {
                name: 'Full Auto Attack',
                description: 'Automated reconnaissance and multi-protocol attack',
                script: 'admin_auto_attack.sh',
                parameters: [
                    {
                        name: 'target',
                        label: 'Target IP/Hostname',
                        type: 'text',
                        required: true,
                        example: '192.168.1.100',
                        help: 'Target to automatically scan and attack',
                        resource: {
                            text: 'Network reconnaissance',
                            url: 'https://nmap.org/book/toc.html'
                        }
                    },
                    {
                        name: 'scan',
                        label: 'Scan First',
                        type: 'checkbox',
                        required: false,
                        default: true,
                        help: 'Perform port scan before attacking'
                    }
                ]
            }
        ]
    }
};

// Load protocol configuration page
function loadProtocol(protocolKey) {
    const config = protocolConfigs[protocolKey];
    if (!config) return;

    const main = document.querySelector('main');
    main.innerHTML = `
        <button class="back-button" onclick="location.reload()">← Back to Protocols</button>
        
        <div class="config-container">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 4em; margin-bottom: 10px;">${config.icon}</div>
                <h1>${config.name} Configuration</h1>
                <p style="color: #aaa; font-size: 1.1em; margin-top: 10px;">${config.description}</p>
            </div>

            <div class="alert alert-info">
                <strong>ℹ️ How to use:</strong> Select a variation below, fill in the required parameters, 
                and click "Generate Script" to create your customized attack command.
            </div>

            <div class="variations-section">
                <h2 style="color: #00ff88; margin-bottom: 20px;">Available Variations</h2>
                ${config.variations.map((variation, index) => `
                    <div class="variation-card">
                        <h3>${variation.name}</h3>
                        <p>${variation.description}</p>
                        <button onclick="showVariationForm('${protocolKey}', ${index})">
                            Configure & Generate →
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Show form for specific variation
function showVariationForm(protocolKey, variationIndex) {
    const config = protocolConfigs[protocolKey];
    const variation = config.variations[variationIndex];

    const main = document.querySelector('main');
    main.innerHTML = `
        <button class="back-button" onclick="loadProtocol('${protocolKey}')">← Back to ${config.name}</button>
        
        <div class="config-container">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 3em; margin-bottom: 10px;">${config.icon}</div>
                <h1>${variation.name}</h1>
                <p style="color: #aaa; font-size: 1.1em;">${variation.description}</p>
            </div>

            <div class="alert alert-warning">
                <strong>⚠️ Legal Warning:</strong> Only use on systems you own or have explicit permission to test.
                Unauthorized access is illegal.
            </div>

            <form id="parameterForm">
                ${variation.parameters.map(param => generateParameterField(param)).join('')}
                
                <div class="button-group">
                    <button type="button" class="btn btn-primary" onclick="generateScript('${protocolKey}', ${variationIndex})">
                        🚀 Generate Script
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="resetForm()">
                        🔄 Reset Form
                    </button>
                </div>
            </form>

            <div id="outputSection" class="output-section hidden">
                <h2 style="color: #00ff88; margin-bottom: 20px;">Generated Script</h2>
                
                <div class="alert alert-info">
                    <strong>📋 Next Steps:</strong> Copy the command below and paste it in your Termux terminal.
                </div>

                <div class="script-output">
                    <button class="copy-button" onclick="copyScript()">📋 Copy</button>
                    <pre id="generatedScript"></pre>
                </div>

                <div class="alert alert-info" style="margin-top: 20px;">
                    <strong>💡 Tips:</strong>
                    <ul style="margin-top: 10px; margin-left: 20px;">
                        <li>Results are saved in the logs/ directory</li>
                        <li>Use -v flag for verbose output</li>
                        <li>Press Ctrl+C to stop the attack</li>
                        <li>Check VPN connection before starting</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
}

// Generate parameter field HTML
function generateParameterField(param) {
    let inputHtml = '';
    
    if (param.type === 'select') {
        inputHtml = `
            <select id="${param.name}" name="${param.name}" ${param.required ? 'required' : ''}>
                ${param.options.map(opt => `
                    <option value="${opt}" ${opt === param.default ? 'selected' : ''}>${opt}</option>
                `).join('')}
            </select>
        `;
    } else if (param.type === 'checkbox') {
        inputHtml = `
            <input type="checkbox" id="${param.name}" name="${param.name}" 
                   ${param.default ? 'checked' : ''} 
                   style="width: auto; margin-right: 10px;">
        `;
    } else {
        inputHtml = `
            <input type="${param.type}" 
                   id="${param.name}" 
                   name="${param.name}" 
                   placeholder="${param.example}" 
                   ${param.default ? `value="${param.default}"` : ''}
                   ${param.required ? 'required' : ''}>
        `;
    }

    return `
        <div class="form-group">
            <label for="${param.name}">
                ${param.label} ${param.required ? '<span style="color: #ff4444;">*</span>' : ''}
            </label>
            ${inputHtml}
            <span class="help-text">${param.help}</span>
            <div class="example">
                <strong>Example:</strong> ${param.example || param.default || 'See documentation'}
            </div>
            ${param.resource ? `
                <a href="${param.resource.url}" class="resource-link" target="_blank">
                    🔗 ${param.resource.text} ↗
                </a>
            ` : ''}
        </div>
    `;
}

// Generate the script command
function generateScript(protocolKey, variationIndex) {
    const config = protocolConfigs[protocolKey];
    const variation = config.variations[variationIndex];
    const form = document.getElementById('parameterForm');
    
    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Build command
    let command = `bash scripts/${variation.script}`;
    
    variation.parameters.forEach(param => {
        const element = document.getElementById(param.name);
        let value = '';
        
        if (param.type === 'checkbox') {
            if (element.checked) {
                command += ` -r`; // Resume flag for scan
            }
        } else {
            value = element.value.trim();
            if (value) {
                // Map parameter names to script flags
                const flagMap = {
                    'target': '-t',
                    'port': '-p',
                    'username': '-u',
                    'wordlist': '-w',
                    'threads': '-T',
                    'path': '-P',
                    'method': '-m',
                    'domain': '-d',
                    'database': '-D'
                };
                
                const flag = flagMap[param.name] || `--${param.name}`;
                command += ` ${flag} "${value}"`;
            }
        }
    });

    // Add verbose flag
    command += ' -v';

    // Display the generated script
    document.getElementById('generatedScript').textContent = command;
    document.getElementById('outputSection').classList.remove('hidden');
    
    // Scroll to output
    document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth' });
}

// Copy script to clipboard
function copyScript() {
    const scriptText = document.getElementById('generatedScript').textContent;
    const button = document.querySelector('.copy-button');
    
    navigator.clipboard.writeText(scriptText).then(() => {
        button.textContent = '✅ Copied!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = '📋 Copy';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        alert('Failed to copy. Please select and copy manually.');
    });
}

// Reset form
function resetForm() {
    document.getElementById('parameterForm').reset();
    document.getElementById('outputSection').classList.add('hidden');
}
