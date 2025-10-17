import './App.css';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Catalog from './components/Catalog/Catalog';
import Cart from './components/Cart/Cart';
import Favorites from './components/Favorites/Favorites';
import Orders from './components/Orders/Orders';
import Login from './components/Auth/Login/Login';
import Register from './components/Auth/Register/Register';
import ProfileClient from './components/Auth/ProfileClient/ProfileClient';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';

function App() {
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const intervalRef = useRef(null);

  const slides = [
    { src: "/images/sweet1.jpg"},
    { src: "/images/sweet2.jpg"},
    { src: "/images/sweet3.jpg"}
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    resetAutoSlide();
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    resetAutoSlide();
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
    resetAutoSlide();
  };

  const resetAutoSlide = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
  };

  useEffect(() => {
    const hash = (location.hash || '').replace(/^#/, '');
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('highlight-about', 'highlight-delivery', 'highlight-guarantees', 'highlight-privacy');
      if (hash === 'about') el.classList.add('highlight-about');
      if (hash === 'delivery') el.classList.add('highlight-delivery');
      if (hash === 'guarantees') el.classList.add('highlight-guarantees');
      if (hash === 'privacy') el.classList.add('highlight-privacy');
      setTimeout(() => {
        el.classList.remove('highlight-about', 'highlight-delivery', 'highlight-guarantees', 'highlight-privacy');
      }, 1200);
    }, 50);
    return () => clearTimeout(t);
  }, [location.hash]);


  return (
    <div className="app-root">
      <Header/>
      <main className="app-content" style={{padding: "20px"}}>
        <Routes>
          <Route
  path="/"
  element={
    <>
      <div className="content-layout">
        <div className="left-content">
          <div className="welcome-block">
            <h2 className="welcome-title">Искусство сладкой жизни</h2>
            <div className="welcome-text">
              <p>В нашем магазине каждая конфета — это история, каждый торт — эмоция, а каждый десерт — маленькое произведение искусства.</p>
              <p>Откройте для себя волшебный мир изысканных сладостей, где традиционные рецепты встречаются с современными вкусами. Насладитесь гармонией нежных текстур, богатых ароматов и изящного исполнения — каждая деталь создана, чтобы дарить вам незабываемые моменты наслаждения.</p>
              <p>Позвольте себе роскошь быть счастливым здесь и сейчас, ведь иногда самое главное скрывается в мелочах — в бархатистом вкусе шоколада, в хрустящей нежности вафель, в воздушной лёгкости крема. Это больше чем просто сладости — это искусство дарить радость.</p>
            </div>
          </div>
        </div>
        <div className="right-content">
          <div className="custom-carousel">
            <div className="carousel-container">
              <img
                className="carousel-image"
                src={slides[currentSlide].src}
                alt={`Слайд ${currentSlide + 1}`}
              />
              <button className="carousel-btn carousel-btn-prev" onClick={prevSlide}>
                ‹
              </button>
              <button className="carousel-btn carousel-btn-next" onClick={nextSlide}>
                ›
              </button>
            </div>

            <div className="carousel-indicators">
              {slides.map((_, index) => (
                <button
                  key={index}
                  className={`indicator ${index === currentSlide ? 'active' : ''}`}
                  onClick={() => goToSlide(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="about-section about-section--grid">
        <div className="about-grid">
          <div className="about-side">
          <div className="about-container about-side-card" id="delivery">
              <h3 className="about-title">Доставка и оплата</h3>
              <p className="about-text">
                Мы заботимся о том, чтобы ваши сладости прибыли быстро, аккуратно и свежими.
                Доставка осуществляется ежедневно по городу и ближайшим районам — курьером или самовывозом из нашей кондитерской.
                Все заказы упаковываются в фирменные коробки, защищающие десерты от повреждений и перепадов температуры.
              </p>
            </div>

            <div className="about-container about-side-card" id="guarantees">
              <h3 className="about-title">Гарантии</h3>
              <p className="about-text">
                Мы уверены в качестве своих десертов и всегда отвечаем за результат.
                Все наши изделия готовятся вручную из свежих и натуральных ингредиентов, без консервантов и искусственных ароматизаторов.
                Каждый торт, пирожное или коробка конфет проходит контроль качества перед отправкой.
              </p>
              <p className="about-text">
                Если по какой-либо причине вы недовольны заказом — просто свяжитесь с нами.
                Мы обязательно разберёмся и предложим решение: замену, компенсацию или скидку на следующий заказ.
              </p>
            </div>
          </div>

          <div className="about-container" id="about">
            <h2 className="about-title">О нас</h2>
            <p className="about-text">
              Наша кондитерская родилась из простой мечты — дарить людям радость через десерты, сделанные с душой, как для родных.
              Мы — команда опытных кондитеров и дизайнеров упаковки, которые бережно соединяют проверенные рецепты с современными идеями:
              от классических тортов до ярких авторских капкейков и конфет ручной работы.
              В производстве используем отборные натуральные ингредиенты и, по возможности, поддержку локальных поставщиков —
              потому что для нас важны вкус и честные продукты.
              Каждый заказ проходит строгий контроль качества и получает индивидуальный подход: мы делаем персональные оформления,
              корпоративные и свадебные решения, а также быструю доставку по городу. Наши десерты не только вкусные, но и фотогеничные —
              идеально подойдут для праздника, подарка или уютного кофейного перерыва.
            </p>
          </div>
        </div>
      </section>
      <section className="about-section about-section--grid">
        <div className="about-grid">
          <div className="about-container about-full" id="privacy">
            <h2 className="about-title">Политика конфиденциальности</h2>
            <p className="about-text">
              Мы уважаем ваше доверие и заботимся о защите личных данных каждого клиента. Настоящая Политика конфиденциальности объясняет, какие данные мы собираем, зачем это нужно и как мы их используем, когда вы оформляете заказ или просто посещаете наш сайт.
            </p>
          </div>
        </div>
      </section>
    </>
  }
/>
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/profile" element={<ProfileClient />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>

      </main>
      <Footer/>
    </div >
  );
}

export default App;