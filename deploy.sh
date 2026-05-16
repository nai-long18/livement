#!/bin/bash
# LiveMent 服务器部署脚本
# 在 Ubuntu 24.04 上运行（SSH 登录后执行）
# 服务器 IP: 178.128.106.253

set -e

echo "=== Step 1: 安装 Node.js 22 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v

echo "=== Step 2: 安装 PM2 进程守护 ==="
sudo npm install -g pm2

echo "=== Step 3: 安装 Nginx ==="
sudo apt-get install -y nginx

echo "=== Step 4: 克隆项目 ==="
cd /opt
sudo git clone https://github.com/nai-long18/livement.git
sudo chown -R $USER:$USER /opt/livement
cd /opt/livement

echo "=== Step 5: 安装依赖 + 构建 ==="
npm install
npm run build

echo "=== Step 6: 配置 PM2 自启动 ==="
pm2 start npm --name "livement" -- start
pm2 save
pm2 startup systemd | grep sudo | bash

echo "=== Step 7: 配置 Nginx 反向代理 ==="
sudo tee /etc/nginx/sites-available/livement > /dev/null << 'NGINX'
server {
    listen 80;
    listen 8080;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;

        # SSE 长连接支持
        proxy_buffering off;
        proxy_read_timeout 24h;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/livement /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "=== Step 8: 放行防火墙 ==="
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status

echo "=== 部署完成! ==="
echo "访问 http://178.128.106.253 即可使用 LiveMent"
echo ""
echo "常用命令:"
echo "  pm2 status          # 查看进程状态"
echo "  pm2 logs livement   # 查看日志"
echo "  pm2 restart livement # 重启服务"
echo "  sudo nginx -s reload # 重载 Nginx"
