CREATE TABLE roles (
    role_id    SERIAL PRIMARY KEY,
    name_role  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    first_name    VARCHAR(50) NOT NULL,
    last_name     VARCHAR(50) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE user_roles (
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE manufacturers (
    manufacturer_id SERIAL PRIMARY KEY,
    name_manufacturers VARCHAR(150) NOT NULL UNIQUE,
    description     TEXT
);

CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name_categories VARCHAR(150) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE products (
    product_id     SERIAL PRIMARY KEY,
    name_product   VARCHAR(200) NOT NULL,
    description    TEXT,
    price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    weight_grams   INT NOT NULL CHECK (weight_grams >= 0),
    photo_url      TEXT,
    category_id    INT REFERENCES categories(category_id) ON DELETE SET NULL,
    manufacturer_id INT REFERENCES manufacturers(manufacturer_id) ON DELETE SET NULL,
    sku            VARCHAR(100),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_manufacturer ON products(manufacturer_id);

CREATE TABLE addresses (
    address_id   SERIAL PRIMARY KEY,
    user_id      INT REFERENCES users(user_id) ON DELETE CASCADE,
    city         VARCHAR(100) NOT NULL,
    street       VARCHAR(200) NOT NULL,
    house        VARCHAR(50) NOT NULL,
    apartment    VARCHAR(50),
    postal_code  VARCHAR(20),
    full_name    VARCHAR(150),
    is_default   BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

CREATE TABLE order_statuses (
    status_id SERIAL PRIMARY KEY,
    code      VARCHAR(50) NOT NULL UNIQUE,
    name_orderstatuses VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE orders (
    order_id       SERIAL PRIMARY KEY,
    user_id        INT REFERENCES users(user_id) ON DELETE SET NULL,
    address_id     INT REFERENCES addresses(address_id) ON DELETE SET NULL,
    status_id      INT REFERENCES order_statuses(status_id) NOT NULL,
    total_amount   NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    delivery_method VARCHAR(100),
    payment_method  VARCHAR(100),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status_id);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id      INT REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id    INT REFERENCES products(product_id) ON DELETE RESTRICT,
    quantity      INT NOT NULL CHECK (quantity > 0),
    price         NUMERIC(10,2) NOT NULL CHECK (price >= 0)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE TABLE payments (
    payment_id   SERIAL PRIMARY KEY,
    order_id     INT UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,
    amount       NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    method_payments VARCHAR(100) NOT NULL,
    status       VARCHAR(50) NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_payments_order ON payments(order_id);

CREATE TABLE reviews (
    review_id   SERIAL PRIMARY KEY,
    product_id  INT REFERENCES products(product_id) ON DELETE CASCADE,
    user_id     INT REFERENCES users(user_id) ON DELETE SET NULL,
    rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment_reviews TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_visible  BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);

CREATE TABLE feedback (
    feedback_id SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(user_id) ON DELETE SET NULL,
    topic       VARCHAR(200),
    message_feedback TEXT NOT NULL,
    email       VARCHAR(255),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status      VARCHAR(50) DEFAULT 'new'
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_name ON products(name_product);

CREATE OR REPLACE FUNCTION fn_recalculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_id INT;
    v_total NUMERIC(12,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_order_id := OLD.order_id;
    ELSE
        v_order_id := NEW.order_id;
    END IF;

    SELECT COALESCE(SUM(price * quantity), 0)::NUMERIC(12,2)
    INTO v_total
    FROM order_items
    WHERE order_id = v_order_id;

    UPDATE orders
    SET total_amount = v_total
    WHERE order_id = v_order_id;

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recalculate_order_total_after_ins_upd_del
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION fn_recalculate_order_total();


CREATE OR REPLACE FUNCTION fn_update_order_status_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_status_id INT;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.status IS NOT NULL THEN
            IF LOWER(NEW.status) = 'paid' THEN
                SELECT status_id INTO v_new_status_id FROM order_statuses WHERE code = 'processing' LIMIT 1;
                IF v_new_status_id IS NOT NULL THEN
                    UPDATE orders SET status_id = v_new_status_id WHERE order_id = NEW.order_id;
                END IF;
            ELSIF LOWER(NEW.status) = 'failed' THEN
                SELECT status_id INTO v_new_status_id FROM order_statuses WHERE code = 'canceled' LIMIT 1;
                IF v_new_status_id IS NOT NULL THEN
                    UPDATE orders SET status_id = v_new_status_id WHERE order_id = NEW.order_id;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_order_status_on_payments
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_update_order_status_on_payment();


CREATE OR REPLACE FUNCTION sp_create_order(
    p_user_id INT,
    p_address_id INT,
    p_items JSON
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_id INT;
    v_status_new INT;
    elem JSON;
    v_product_id INT;
    v_quantity INT;
    v_price NUMERIC(10,2);
BEGIN
    SELECT status_id INTO v_status_new FROM order_statuses WHERE code = 'new' LIMIT 1;
    IF v_status_new IS NULL THEN
        RAISE EXCEPTION 'Order status code "new" not found in order_statuses';
    END IF;

    INSERT INTO orders (user_id, address_id, status_id, total_amount, created_at)
	VALUES (p_user_id, p_address_id, v_status_new, 0, now())
	RETURNING order_id INTO v_order_id;

    FOR elem IN SELECT * FROM json_array_elements(p_items)
    LOOP
        v_product_id := (elem->>'product_id')::INT;
        v_quantity   := COALESCE((elem->>'quantity')::INT, 1);

        SELECT price INTO v_price FROM products WHERE product_id = v_product_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with id % not found', v_product_id;
        END IF;

        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (v_order_id, v_product_id, v_quantity, v_price);
    END LOOP;
	
    RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION sp_add_product(
    p_name_product VARCHAR,
    p_description TEXT,
    p_price NUMERIC,
    p_weight_grams INT,
    p_photo_url TEXT,
    p_category_name VARCHAR,
    p_manufacturer_name VARCHAR,
    p_sku VARCHAR
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_category_id INT;
    v_manufacturer_id INT;
    v_product_id INT;
BEGIN
    IF p_price IS NULL OR p_price < 0 THEN
        RAISE EXCEPTION 'Invalid price';
    END IF;

    IF p_weight_grams IS NULL OR p_weight_grams < 0 THEN
        RAISE EXCEPTION 'Invalid weight_grams';
    END IF;

    IF p_category_name IS NOT NULL THEN
        SELECT category_id INTO v_category_id FROM categories WHERE name_categories = p_category_name LIMIT 1;
        IF v_category_id IS NULL THEN
            INSERT INTO categories (name_categories, description) VALUES (p_category_name, NULL) RETURNING category_id INTO v_category_id;
        END IF;
    END IF;

    IF p_manufacturer_name IS NOT NULL THEN
        SELECT manufacturer_id INTO v_manufacturer_id FROM manufacturers WHERE name_manufacturers = p_manufacturer_name LIMIT 1;
        IF v_manufacturer_id IS NULL THEN
            INSERT INTO manufacturers (name_manufacturers, description) VALUES (p_manufacturer_name, NULL) RETURNING manufacturer_id INTO v_manufacturer_id;
        END IF;
    END IF;

    INSERT INTO products (name_product, description, price, weight_grams, photo_url, category_id, manufacturer_id, sku, created_at)
    VALUES (p_name_product, p_description, p_price, p_weight_grams, p_photo_url, v_category_id, v_manufacturer_id, p_sku, now())
    RETURNING product_id INTO v_product_id;

    RETURN v_product_id;
END;
$$;


INSERT INTO roles (role_id, name_role) VALUES
(1, 'admin'),
(2, 'manager'),
(3, 'client');

INSERT INTO manufacturers (manufacturer_id, name_manufacturers, description) VALUES
(1, 'Сладкая Фабрика', 'Семейная кондитерская, создающая душевные десерты из натуральных ингредиентов: от классики до авторских сладостей.'),
(2, 'Шоколадная фабрика', 'Мастерская премиального шоколада: отборное какао, ручная обработка и изысканные вкусовые сочетания.');

INSERT INTO categories (category_id, name_categories, description) VALUES
(1, 'Шоколад', 'Насыщенный, тающий во рту шоколад из отборного какао с богатыми ароматами.'),
(2, 'Конфеты', 'Разнообразные конфеты ручной работы: пралине, трюфели и карамель — идеальны для подарка.'),
(3, 'Торты', 'Праздничные торты с индивидуальным дизайном и свежими ингредиентами, создающие событие.'),
(4, 'Чизкейки', 'Нежные, сливочные чизкейки на хрустящей основе с яркой текстурой и балансом сладости.'),
(5, 'Капкейк', 'Нежные мини-торты с воздушным бисквитом и аппетитным кремом, созданные для сладких моментов радости.');

INSERT INTO products (product_id, name_product, description, price, weight_grams, photo_url, category_id, manufacturer_id, sku) VALUES
(1, 'Капкейки с черникой', 'Этот капкейк — настоящее произведение искусства! Нежный ванильный бисквит, пропитанный черничным сиропом, словно создан для того, чтобы покорить сердца любителей сладкого. Внутри скрывается сочная начинка из черничного пюре и сливочного крема, которая делает каждый кусочек незабываемым.', 199.50, 100, 'C:\Users\Lenovo\shop\first-site\public\images\sweet4.jpg', 5, 2, 'DC100'),
(2, 'Черничный чизкейк', 'Черничный чизкейк — это нежный десерт, который сочетает в себе сливочный вкус крем-сыра и освежающую кислинку черники. Он состоит из рассыпчатой основы из печенья, кремовой начинки и ягодного слоя, украшенного свежими ягодами.', 499.00, 250, 'C:\Users\Lenovo\shop\first-site\public\images\sweet5.jpg', 4, 1, 'MC250'),
(3, 'Неаполитанские капкейки', 'Неаполитанские капкейки — это десерт, вдохновленный классическим итальянским мороженым «Неаполитан», которое сочетает три вкуса: шоколад, ваниль и клубника. Эти капкейки отличаются многослойной структурой, где каждый слой представляет один из этих вкусов.', 149.00, 200, 'C:\Users\Lenovo\shop\first-site\public\images\sweet6.jpg', 5, 1, 'SC200'),
(4, 'Черный лес', 'Шварцвальдский вишневый торт, или «Черный лес», — это знаменитый немецкий десерт, который сочетает в себе насыщенный шоколадный вкус, нежность сливок и кислинку вишни. Его название связано с регионом Шварцвальд (Черный лес) в Германии, где, по легенде, этот торт был впервые приготовлен.', 129.50, 150, 'C:\Users\Lenovo\shop\first-site\public\images\sweet7.jpg', 3, 2, 'CT150'),
(5, 'Чизкейк «Red Velvet Oreo»', 'Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.', 219.00, 300, 'C:\Users\Lenovo\shop\first-site\public\images\sweet8.jpg', 4, 1, 'BC300'),
(6, 'Торт «Красный бархат»', 'Торт «Красный бархат» — это классический американский десерт, который отличается насыщенным красным цветом, нежным вкусом и бархатистой текстурой. Его история уходит корнями в XIX век, когда он был известен под разными названиями, такими как «Красный Уолдорфский торт» или «Красный ковровый торт».', 189.00, 280, 'C:\Users\Lenovo\shop\first-site\public\images\sweet9.jpg', 3, 2, 'OC280');

INSERT INTO order_statuses (status_id, code, name_orderstatuses, description) VALUES
(1, 'new', 'Новый', 'Новый заказ'),
(2, 'processing', 'В обработке', 'Заказ обрабатывается'),
(3, 'shipped', 'Отправлен', 'Заказ отправлен'),
(4, 'delivered', 'Доставлен', 'Заказ доставлен'),
(5, 'canceled', 'Отменён', 'Заказ отменён');

INSERT INTO payments (payment_id, order_id, amount, method_payments, status) VALUES
(1, 5, 497.50, 'card', 'paid'),
(2, 6, 607.50, 'paypal', 'pending');



select * from products

select * from manufacturers

select * from orders

select * from users