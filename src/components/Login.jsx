import React, { useState } from 'react';

export default function Login({ onLogin }) {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	async function submit(e) {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			await onLogin({ username, password });
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<form className="form" onSubmit={submit}>
			<h2>Admin Login</h2>
			<label>
				Username
				<input value={username} onChange={e => setUsername(e.target.value)} required />
			</label>
			<label>
				Password
				<input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
			</label>
			<button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
			{error && <div className="error">{error}</div>}
		</form>
	);
}


