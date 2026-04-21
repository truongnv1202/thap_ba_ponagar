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

## 4) Deploy bang Docker (khuyen nghi)

### Yeu cau

- Server da cai Docker + Docker Compose plugin.
- Domain `thapba.lumina-x.vn` da tro A record ve server.

### Chay tren server

```bash
cd /var/www
git clone https://github.com/truongnv1202/thap_ba_ponagar.git gamethapba || true
cd /var/www/gamethapba
git pull origin main
```

Dat JWT secret that (bat buoc):

```bash
sed -i 's/JWT_SECRET: replace-with-a-strong-secret/JWT_SECRET: YOUR_STRONG_SECRET_HERE/g' docker-compose.yml
```

Build va chay:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f nginx
```

Stack Docker se chay:
- Postgres noi bo (`db`)
- Prisma migration 1 lan (`migrate`)
- 3 API service: `api-2996`, `api-2997`, `api-2998`
- Frontend static (`web`)
- Nginx public cong `80` (`nginx`)

### SSL voi Cloudflare

Neu dung Cloudflare proxy, uu tien SSL mode `Full (strict)`.
