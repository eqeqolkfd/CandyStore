import './Header.css';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

function Header() {
  const navigate = useNavigate();
  const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
  const currentUser = stored ? JSON.parse(stored) : null;
  const isClient = !!(currentUser && currentUser.role === 'client');
  const isManager = !!(currentUser && currentUser.role === 'manager');
  const isAuthorized = !!(currentUser && currentUser.userId);
  const isAdmin = !!(currentUser && currentUser.role === 'admin');
  return (
    <header>
      <nav className="header-nav">
        <div className="block-header-left">
          <h1>SweetShop</h1>
          <ul className="list-header-left">
            <li className="menu-button"><Link to="/">Главная</Link></li>
            {isAdmin && <li className="menu-button"><Link to="/admin/products">Товары</Link></li>}
            {isAdmin && <li className="menu-button"><Link to="/admin/users">Пользователи</Link></li>}
            {isManager && <li className="menu-button"><Link to="/manager">Отчетность</Link></li>}
            {isAdmin && <li className="menu-button"><Link to="/admin/orders">Заказы</Link></li>}
            {isAdmin && <li className="menu-button"><Link to="/admin/audit">Журнал аудита</Link></li>}
            {!isAdmin && !isManager && <li className="menu-button"><Link to="/catalog">Каталог</Link></li>}
            {!isAdmin && !isManager && isAuthorized && <li className="menu-button"><Link to="/favorites">Избранное</Link></li>}
            {!isAdmin && !isManager && isAuthorized && <li className="menu-button"><Link to="/cart">Корзина</Link></li>}
            {!isAdmin && !isManager && isAuthorized && <li className="menu-button"><Link to="/orders">Мои заказы</Link></li>}
            {!isAuthorized && <li className="menu-button"><Link to="/register">Регистрация</Link></li>}
            {!isAuthorized && <li className="menu-button"><Link to="/login">Авторизация</Link></li>}
          </ul>
        </div>
        <ul className="list-header-right">
          {isAuthorized && <li className="menu-button"><Link to="/profile">Профиль</Link></li>}
          {isAuthorized && (
            <button
              className="logout-button"
              onClick={async () => {
                try {
                  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
                  const cu = storedUser ? JSON.parse(storedUser) : null;
                  if (cu?.userId) {
                    try {
                      await fetch('http://localhost:5000/api/users/logout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: cu.userId })
                      });
                    } catch (_) {}
                  }
                  localStorage.removeItem('currentUser');
                } catch (_) {}
                navigate('/');
              }}
            >
              Выход
            </button>
          )}
        </ul>
      </nav>
    </header>
  );
}

export default Header;