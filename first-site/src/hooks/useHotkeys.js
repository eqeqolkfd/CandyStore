import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const useHotkeys = (userRole) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.shiftKey && event.key === '!') {
        event.preventDefault();
        if (userRole === 'admin') {
          navigate('/admin/orders');
        }
        return;
      }
      
      if (event.altKey && event.shiftKey) {
        event.preventDefault();
        if (userRole === 'admin') {
          navigate('/admin/audit');
        }
        return;
      }
      
      if (event.shiftKey && event.key === '#') {
        event.preventDefault();
        if (userRole === 'client' || userRole === 'manager' || userRole === 'admin') {
          navigate('/profile');
        }
        return;
      }
      
      if (event.altKey) {
        const key = event.key;
        
        switch (key) {
          case '1':
            event.preventDefault();
            navigate('/');
            break;
            
          case '2':
            event.preventDefault();
            if (!userRole || userRole === 'client') {
              navigate('/catalog');
            }
            break;
            
          case '3':
            event.preventDefault();
            if (!userRole) {
              navigate('/register');
            }
            break;
            
          case '4':
            event.preventDefault();
            if (!userRole) {
              navigate('/login');
            }
            break;
            
          case '5':
            event.preventDefault();
            if (userRole === 'client') {
              navigate('/favorites');
            }
            break;
            
          case '6':
            event.preventDefault();
            if (userRole === 'client') {
              navigate('/cart');
            }
            break;
            
          case '7':
            event.preventDefault();
            if (userRole === 'client') {
              navigate('/orders');
            }
            break;
            
          case '8':
            event.preventDefault();
            if (userRole === 'manager') {
              navigate('/manager');
            }
            break;
            
          case '9':
            event.preventDefault();
            if (userRole === 'admin') {
              navigate('/admin/products');
            }
            break;
            
          case '0':
            event.preventDefault();
            if (userRole === 'admin') {
              navigate('/admin/users');
            }
            break;
            
            
          default:
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, userRole]);
};

export default useHotkeys;
