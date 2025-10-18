import './Header.css';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

function Header() {
  const navigate = useNavigate();
  const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
  const currentUser = stored ? JSON.parse(stored) : null;
  const isClient = !!(currentUser && currentUser.role === 'client');
  const isAuthorized = !!(currentUser && currentUser.userId);
  return (
    <header>
      <nav className="header-nav">
        <div className="block-header-left">
          <h1>SweetShop</h1>
          <ul className="list-header-left">
            <li className="menu-button"><Link to="/">Главная</Link></li>
            <li className="menu-button"><Link to="/catalog">Каталог</Link></li>
            {isAuthorized && <li className="menu-button"><Link to="/favorites">Избранное</Link></li>}
            {isAuthorized && <li className="menu-button"><Link to="/cart">Корзина</Link></li>}
            {isAuthorized && <li className="menu-button"><Link to="/orders">Мои заказы</Link></li>}
            {!isClient && <li className="menu-button"><Link to="/register">Регистрация</Link></li>}
            {!isClient && <li className="menu-button"><Link to="/login">Авторизация</Link></li>}
          </ul>
        </div>
        <ul className="list-header-right">
          {isAuthorized && <li className="menu-button"><Link to="/profile">Профиль</Link></li>}
          {isAuthorized && (
            <button
              className="logout-button"
              onClick={() => {
                try {
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