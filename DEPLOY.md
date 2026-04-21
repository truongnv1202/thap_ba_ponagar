# Deploy `thapba.lumina-x.vn`

## 1) Khoi tao git va push len remote

Chay tai local:

```bash
cd /Users/tb/Documents/gamethapba
git init
git add .
git commit -m "chore: setup deployment configs for pm2 and nginx"
git branch -M main
git remote add origin <YOUR_GIT_REMOTE_URL>
git push -u origin main
```

## 2) Setup server `104.64.208.149`

Dang nhap server:

```bash
ssh <USER>@104.64.208.149
```

Cai package can thiet:

```bash
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

Lay code:

```bash
sudo mkdir -p /var/www/gamethapba
sudo chown -R $USER:$USER /var/www/gamethapba
git clone <YOUR_GIT_REMOTE_URL> /var/www/gamethapba
cd /var/www/gamethapba
npm ci
npm run build
cd web
npm ci
npm run build
```

Chay API 3 cong 2996/2997/2998:

```bash
cd /var/www/gamethapba
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 3) Cau hinh nginx cho domain

```bash
sudo cp /var/www/gamethapba/nginx/thapba.lumina-x.vn.conf /etc/nginx/sites-available/thapba.lumina-x.vn
sudo ln -sf /etc/nginx/sites-available/thapba.lumina-x.vn /etc/nginx/sites-enabled/thapba.lumina-x.vn
sudo nginx -t
sudo systemctl reload nginx
```

Neu dung SSL:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d thapba.lumina-x.vn
```
