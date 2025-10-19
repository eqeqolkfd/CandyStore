import './Footer.css'
import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section footer-brand">
          <h3 className="footer-title">SweetShop</h3>
          <p className="footer-description">
            Искусство сладкой жизни в каждом десерте.
            Мы создаём незабываемые моменты радости.
          </p>
        </div>

        <div className="footer-section footer-info">
          <h4 className="footer-subtitle">Информация</h4>
          <ul className="footer-links">
            <li><Link to="/#about">О нас</Link></li>
            <li><Link to="/#delivery">Доставка и оплата</Link></li>
            <li><Link to="/#guarantees">Гарантии</Link></li>
          </ul>
        </div>

        <div className="footer-section footer-contacts">
          <h4 className="footer-subtitle">Контакты</h4>
          <div className="contact-info">
            <p>ул. Сладкая, 123, Москва</p>
            <p>+7 (495) 999-99-99</p>
            <p>info@sweetshop.ru</p>
            <p>Пн-Пт: 10:00 - 22:00</p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p className="copyright">©2025 SweetShop. Все права защищены.</p>
          <div className="footer-legal">
            <Link to="/#privacy">Политика конфиденциальности</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;