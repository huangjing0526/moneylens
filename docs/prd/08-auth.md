# 08 认证与安全

## 功能概述

简单的密码保护机制，适用于个人/家庭部署场景。通过环境变量设置密码，Cookie 维持登录态。

## 实现

### 中间件 (`src/middleware.ts`)

- 当 `APP_PASSWORD` 环境变量存在时启用认证
- 检查 `moneylens_auth` Cookie 值是否等于密码
- 放行路径：`/login`、`/api/auth/login`、静态资源
- 未认证请求重定向到 `/login`

### 登录 API (`POST /api/auth/login`)

- 接收 `{ password }` JSON body
- 与 `APP_PASSWORD` 环境变量比对
- 成功：设置 `moneylens_auth` httpOnly Cookie，有效期 30 天
- 失败：返回 401

### 登录页 (`src/app/login/page.tsx`)

- 单一密码输入框 + 提交按钮
- 登录成功后跳转到 `/`

## 配置

| 环境变量 | 说明 |
|---------|------|
| `APP_PASSWORD` | 访问密码。不设置则不启用认证 |

## 安全说明

- Cookie 设置为 httpOnly，防止 XSS 读取
- 密码明文存储在环境变量中（适用于个人部署场景）
- 无用户系统、无注册功能、无多租户

## 测试覆盖

- `src/middleware.test.ts` — 中间件鉴权逻辑
- `src/tests/security.test.ts` — 安全相关测试
