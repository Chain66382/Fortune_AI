# Deploy Fortune AI to Oracle Cloud Always Free

This project cannot be hosted by GitHub Actions alone. GitHub Actions only runs CI/CD jobs and can trigger deployments. The public app must run on a server.

For the current architecture, Oracle Cloud Always Free VM is the best fit because the app uses:

- Next.js server routes
- SQLite
- Local upload storage

## 1. Create the Oracle VM

Recommended baseline:

- Ubuntu 24.04
- Public IP
- Open ports: `80`, `443`, `22`

## 2. Install the app host

SSH into the VM and clone the repo:

```bash
git clone git@github.com:Chain66382/Fortune_AI.git /opt/fortune-ai/app
cd /opt/fortune-ai/app
sudo bash deploy/oracle/bootstrap-server.sh
```

## 3. Configure production environment

Create the environment file:

```bash
sudo mkdir -p /etc/fortune-ai
sudo cp deploy/oracle/fortune-ai.env.example /etc/fortune-ai/fortune-ai.env
sudo nano /etc/fortune-ai/fortune-ai.env
```

Set at least:

- `FORTUNE_AI_API_KEY`
- `FORTUNE_AI_BASE_URL`
- `FORTUNE_AI_MODEL`

If you prefer Gemini, set `GEMINI_API_KEY` instead.

## 4. Build and start the service

```bash
cd /opt/fortune-ai/app
npm ci
npm run build
sudo systemctl start fortune-ai
sudo systemctl status fortune-ai
```

## 5. Configure HTTPS

After your domain points to the VM, install TLS:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 6. Configure GitHub Actions auto-deploy

Add these GitHub repository secrets:

- `ORACLE_HOST`: your VM public IP or domain
- `ORACLE_USER`: SSH user, for example `ubuntu`
- `ORACLE_SSH_KEY`: private key content used by GitHub Actions
- `ORACLE_APP_DIR`: `/opt/fortune-ai/app`

Workflow file:

- `.github/workflows/deploy-oracle.yml`

When you push to `main`, GitHub Actions will:

1. connect to your Oracle VM by SSH
2. fetch the latest commit
3. run `npm ci`
4. run `npm run build`
5. restart `fortune-ai`

## 7. Rollback

On the server:

```bash
cd /opt/fortune-ai/app
git log --oneline -n 10
git checkout --force <commit-sha>
npm ci
npm run build
sudo systemctl restart fortune-ai
```

Or rerun the deploy script with an older commit SHA.

## Notes

- GitHub Actions is used for deployment automation, not hosting.
- GitHub Pages is not suitable for this app because it only supports static sites.
- If you later move database and uploads to managed services, Vercel becomes an easier hosting option.
