# TTP2026 AI战略看板 — 生产部署说明

## 域名发布配置

**目标域名：** `ttp2026kanban.xyz`  
**服务器公网IP：** `34.173.133.180`  
**当前状态：** Nginx + FastAPI 已就绪，等待DNS解析配置

---

## 第一步：DNS解析配置（需域名持有人操作）

登录域名注册商（如阿里云、腾讯云、Cloudflare 等）的 DNS 管理控制台，添加以下解析记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| A | @ | `34.173.133.180` | 600 |
| A | www | `34.173.133.180` | 600 |

> DNS 生效时间通常为 5～30 分钟，最长 48 小时。

---

## 第二步：SSL 证书申请（DNS生效后执行）

DNS 解析生效后，在服务器上执行以下命令申请免费 SSL 证书：

```bash
sudo certbot --nginx -d ttp2026kanban.xyz -d www.ttp2026kanban.xyz \
  --non-interactive --agree-tos --email admin@ttp2026kanban.xyz \
  --redirect
```

证书申请成功后，Nginx 将自动配置 HTTPS，并将 HTTP 请求重定向到 HTTPS。

---

## 第三步：设置开机自启

```bash
# 启动后端服务
sudo systemctl start ttp2026kanban
sudo systemctl enable ttp2026kanban

# 设置 Nginx 开机自启
sudo systemctl enable nginx
```

---

## 当前服务状态

| 服务 | 端口 | 状态 |
|---|---|---|
| FastAPI 后端 | 8000 | ✅ 运行中 |
| Nginx 反向代理 | 80 | ✅ 运行中 |
| MySQL 数据库 | 3306 | ✅ 运行中 |
| HTTPS (SSL) | 443 | ⏳ 等待DNS生效后申请 |

---

## 系统账号

| 用户名 | 密码 | 角色 |
|---|---|---|
| admin | ttp2026admin | 总管理员 |
| qianwei | ttp2026@qianwei | 前线委员会 |
| huojunjun | ttp2026@huojunjun | 火箭军 |
| yanwei | ttp2026@yanwei | 研发委员会 |
| zhengjiju | ttp2026@zhengjiju | 政治局 |
| shendunjv | ttp2026@shendunjv | 神盾局 |
| ziguanwei | ttp2026@ziguanwei | 资管委 |
| jianwei | ttp2026@jianwei | 检委会 |
| haiwei | ttp2026@haiwei | 海委会 |
| zuzhihu | ttp2026@zuzhihu | 组织部 |
| caiwubu | ttp2026@caiwubu | 财务部 |
| dangzuzhi | ttp2026@dangzuzhi | 党组织 |
| canmoubu | ttp2026@canmoubu | 参谋部 |
| zhengzhibu | ttp2026@zhengzhibu | 政治部 |

---

## 快速验证命令

```bash
# 检查后端是否正常
curl http://localhost:8000/api/health

# 检查 Nginx 是否正常
curl -I http://localhost:80/

# DNS 生效后检查域名访问
curl -I http://ttp2026kanban.xyz/

# 查看后端日志
tail -f /tmp/backend.log

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/ttp2026kanban_access.log
```

---

## 说明书权限说明

- **管理员（admin）**：说明书中显示「账号权限」标签页，包含所有账号的用户名、默认密码、角色、可见范围
- **部门成员**：说明书中**不显示**「账号权限」标签页，仅展示系统介绍、字段说明、积分规则、效益核算、操作流程

---

## 钉钉通知配置

1. 管理员登录后，点击顶部「🔔 钉钉通知」按钮
2. 在「应用连接」标签页填写 App ID、Client ID、AgentId
3. 点击「保存配置」或「测试写入」（管理员身份验证通过即保存成功）
4. 在「群通知配置」标签页填写群机器人 Webhook URL
5. 点击「保存 Webhook」后即可接收任务状态变更通知
