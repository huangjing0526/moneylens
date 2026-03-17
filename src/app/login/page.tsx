'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('密码错误');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f2f2f7] flex items-center justify-center p-4">
      <div className="w-full max-w-[320px] space-y-6">
        <div className="text-center">
          <img src="/icon.svg" alt="钱迹" className="w-16 h-16 mx-auto rounded-2xl mb-3" />
          <h1 className="text-xl font-semibold text-[#1c1c1e]">钱迹</h1>
          <p className="text-sm text-[#8e8e93] mt-1">请输入访问密码</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            autoFocus
            className="w-full px-4 py-3 bg-white rounded-xl text-[15px] text-[#1c1c1e] outline-none focus:ring-2 focus:ring-[#007aff]/30"
          />
          {error && <p className="text-sm text-[#ff3b30] text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-[#007aff] text-white text-[15px] font-medium rounded-xl disabled:opacity-50 transition-opacity"
          >
            {loading ? '验证中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
