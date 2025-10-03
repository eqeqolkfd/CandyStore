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
    phone        VARCHAR(30),
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
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
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
    provider_txn_id VARCHAR(255),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
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