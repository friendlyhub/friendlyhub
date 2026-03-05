import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, loadUser } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setToken(token);
      loadUser().then(() => navigate('/'));
    } else {
      navigate('/');
    }
  }, [params, setToken, loadUser, navigate]);

  return (
    <div className="text-center py-12 text-gray-500">Signing in...</div>
  );
}
