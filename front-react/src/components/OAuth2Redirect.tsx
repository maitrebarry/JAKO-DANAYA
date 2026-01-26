import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { withApi } from '../config/api';

const OAuth2Redirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUserData } = useUser();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      navigate('/');
      return;
    }

    if (!token) {
      navigate('/');
      return;
    }

    const finalize = async () => {
      localStorage.setItem('smb_token', token);
      const profileRes = await fetch(withApi('auth/me'), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!profileRes.ok) {
        localStorage.removeItem('smb_token');
        navigate('/');
        return;
      }

      const profileData = await profileRes.json();
      setUserData(profileData);
      localStorage.setItem('smb_user_data', JSON.stringify(profileData));
      navigate('/dashboard');
    };

    finalize();
  }, [location.search, navigate, setUserData]);

  return null;
};

export default OAuth2Redirect;
