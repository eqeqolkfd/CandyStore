import './Header.css';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../../constants/api';

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
            <li className="menu-button"><Link to="/">Главная <kbd>Alt+1</kbd></Link></li>
            {isAdmin && <li className="menu-button"><Link to="/admin/products">Товары <kbd>Alt+9</kbd></Link></li>}
            {isAdmin && <li className="menu-button"><Link to="/admin/users">Пользователи <kbd>Alt+0</kbd></Link></li>}
            {isManager && <li className="menu-button"><Link to="/manager">Отчетность <kbd>Alt+8</kbd></Link></li>}
            {isAdmin && <li className="menu-button"><Link to="/admin/orders">Заказы <kbd>Shift+!</kbd></Link></li>}
            {isAdmin && <li className="menu-button"><Link to="/admin/audit">Журнал аудита <kbd>Shift+@</kbd></Link></li>}
            {!isAdmin && !isManager && <li className="menu-button"><Link to="/catalog">Каталог <kbd>Alt+2</kbd></Link></li>}
            {!isAdmin && !isManager && isAuthorized && <li className="menu-button"><Link to="/favorites">Избранное <kbd>Alt+5</kbd></Link></li>}
            {!isAdmin && !isManager && isAuthorized && <li className="menu-button"><Link to="/cart">Корзина <kbd>Alt+6</kbd></Link></li>}
            {!isAdmin && !isManager && isAuthorized && <li className="menu-button"><Link to="/orders">Мои заказы <kbd>Alt+7</kbd></Link></li>}
            {!isAuthorized && <li className="menu-button"><Link to="/register">Регистрация <kbd>Alt+3</kbd></Link></li>}
            {!isAuthorized && <li className="menu-button"><Link to="/login">Авторизация <kbd>Alt+4</kbd></Link></li>}
          </ul>
        </div>
        <ul className="list-header-right">
          {isAuthorized && <li className="menu-button"><Link to="/profile">Профиль <kbd>Shift+#</kbd></Link></li>}
          {isAuthorized && (
            <button
              className="logout-button"
              onClick={async () => {
                try {
                  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
                  const cu = storedUser ? JSON.parse(storedUser) : null;
                  if (cu?.userId) {
                    try {
                      await fetch(API_ENDPOINTS.LOGOUT, {
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