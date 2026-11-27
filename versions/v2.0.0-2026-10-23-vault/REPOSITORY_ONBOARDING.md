# Repository Onboarding & Sync Protocol // Q>1 Ecosystem

## Objective
Enable secure, automated synchronization of all ecosystem repositories to GitHub.

## 1. Prerequisites (SSH Setup)
Because this system requires non-interactive pushing, you MUST use SSH keys. 
1. Generate an SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add the public key (`~/.ssh/id_ed25519.pub`) to your GitHub account under **Settings > SSH and GPG keys**.
3. Test the connection: `ssh -T git@github.com`

## 3. Agent Interaction Protocol
All interactions with the AI agent follow a mandatory orchestration protocol:
1. **Prompt Analysis**: The agent analyzes every user request and references the `DOCUMENTATION_INDEX.md` for context.
2. **Skill Activation**: Relevant skills are automatically activated via `activate_skill`.
3. **Swarm Signaling**: The agent simultaneously logs tasks to the Honeycomb swarm (`/data/data/com.termux/files/home/.pm2/logs/honeycomb-watchdog-out.log`) for parallel, autonomous investigation and self-healing.
4. **Execution & Validation**: The task is executed with full specialized context, while the swarm monitors for anomalies.
