--
-- PostgreSQL database dump
--

-- Dumped from database version 16.0
-- Dumped by pg_dump version 16.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: order_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_status_enum AS ENUM (
    'pending',
    'paid',
    'completed',
    'cancelled'
);


ALTER TYPE public.order_status_enum OWNER TO postgres;

--
-- Name: payment_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_status_enum AS ENUM (
    'pending',
    'paid',
    'refunded'
);


ALTER TYPE public.payment_status_enum OWNER TO postgres;

--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role_enum AS ENUM (
    'customer',
    'admin'
);


ALTER TYPE public.user_role_enum OWNER TO postgres;

--
-- Name: fn_audit_row_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_audit_row_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    v_op            TEXT := TG_OP;                 -- INSERT / UPDATE / DELETE
    v_table         TEXT := TG_TABLE_NAME;
    v_before        JSONB;
    v_after         JSONB;
    v_actor_txt     TEXT;
    v_actor_id      INT;
    v_ip_txt        TEXT;
    v_user_agent_txt TEXT;
    v_json          JSONB;
    v_target_id_txt TEXT;
    v_target_id     INT;
    v_target_name   TEXT;
    v_singular      TEXT;
    sensitive_cols  TEXT[] := ARRAY['password','password_hash','secret','token'];
    col TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_before := NULL;
        v_after  := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_before := to_jsonb(OLD);
        v_after  := NULL;
    ELSE
        v_before := to_jsonb(OLD);
        v_after  := to_jsonb(NEW);
    END IF;

    FOREACH col IN ARRAY sensitive_cols LOOP
        IF v_before IS NOT NULL THEN v_before := v_before - col; END IF;
        IF v_after  IS NOT NULL THEN v_after  := v_after  - col; END IF;
    END LOOP;

    v_actor_txt := current_setting('audit.user_id', true);
    IF v_actor_txt IS NOT NULL THEN
        BEGIN
            v_actor_id := v_actor_txt::INT;
        EXCEPTION WHEN others THEN
            v_actor_id := NULL;
        END;
    END IF;

    v_ip_txt := current_setting('audit.ip', true);
    v_user_agent_txt := current_setting('audit.user_agent', true);

    v_json := COALESCE(v_after, v_before);
    v_singular := regexp_replace(v_table, 's$', '');

    IF v_json IS NOT NULL THEN
        v_target_id_txt := COALESCE(
            v_json ->> (v_table || '_id'),
            v_json ->> 'id',
            v_json ->> (v_singular || '_id')
        );

        IF v_target_id_txt IS NOT NULL AND v_target_id_txt ~ '^[0-9]+$' THEN
            v_target_id := v_target_id_txt::INT;
        END IF;

        v_target_name := COALESCE(
            v_json ->> 'name',
            (v_json ->> 'first_name') || ' ' || (v_json ->> 'last_name'),
            v_json ->> 'title',
            NULL
        );

        IF v_target_name IS NOT NULL THEN
            v_target_name := regexp_replace(v_target_name, '(^\s+|\s+$)', '', 'g');
            IF v_target_name ~ '^null' THEN v_target_name := NULL; END IF;
        END IF;
    END IF;

    PERFORM fn_insert_audit(
        p_action      => v_op,
        p_user_id     => v_actor_id,
        p_target_type => upper(v_table),
        p_target_id   => v_target_id,
        p_target_name => v_target_name,
        p_before      => v_before,
        p_after       => v_after,
        p_details     => jsonb_build_object('table', v_table, 'tg_op', v_op),
        p_severity    => 'LOW',
        p_ip          => CASE WHEN v_ip_txt IS NOT NULL THEN v_ip_txt::inet ELSE NULL END,
        p_user_agent  => v_user_agent_txt
    );

    RETURN NULL;
END;
$_$;


ALTER FUNCTION public.fn_audit_row_change() OWNER TO postgres;

--
-- Name: fn_insert_audit(text, integer, text, integer, text, jsonb, jsonb, jsonb, character varying, inet, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_insert_audit(p_action text, p_user_id integer DEFAULT NULL::integer, p_target_type text DEFAULT NULL::text, p_target_id integer DEFAULT NULL::integer, p_target_name text DEFAULT NULL::text, p_before jsonb DEFAULT NULL::jsonb, p_after jsonb DEFAULT NULL::jsonb, p_details jsonb DEFAULT NULL::jsonb, p_severity character varying DEFAULT 'LOW'::character varying, p_ip inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO audit_logs(
        "timestamp",
        "action",
        user_id,
        target_type,
        target_id,
        target_name,
        details,
        before_data,
        after_data,
        severity,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        now(),
        p_action,
        p_user_id,
        p_target_type,
        p_target_id,
        p_target_name,
        p_details,
        p_before,
        p_after,
        p_severity,
        p_ip,
        p_user_agent,
        now()
    );
END;
$$;


ALTER FUNCTION public.fn_insert_audit(p_action text, p_user_id integer, p_target_type text, p_target_id integer, p_target_name text, p_before jsonb, p_after jsonb, p_details jsonb, p_severity character varying, p_ip inet, p_user_agent text) OWNER TO postgres;

--
-- Name: fn_log_manual_event(text, integer, text, integer, text, jsonb, character varying, inet, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_log_manual_event(p_action text, p_user_id integer DEFAULT NULL::integer, p_target_type text DEFAULT NULL::text, p_target_id integer DEFAULT NULL::integer, p_target_name text DEFAULT NULL::text, p_details jsonb DEFAULT NULL::jsonb, p_severity character varying DEFAULT 'LOW'::character varying, p_ip inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM fn_insert_audit(
        p_action      => p_action,
        p_user_id     => p_user_id,
        p_target_type => p_target_type,
        p_target_id   => p_target_id,
        p_target_name => p_target_name,
        p_before      => NULL,
        p_after       => NULL,
        p_details     => p_details,
        p_severity    => p_severity,
        p_ip          => p_ip,
        p_user_agent  => p_user_agent
    );
END;
$$;


ALTER FUNCTION public.fn_log_manual_event(p_action text, p_user_id integer, p_target_type text, p_target_id integer, p_target_name text, p_details jsonb, p_severity character varying, p_ip inet, p_user_agent text) OWNER TO postgres;

--
-- Name: fn_recalculate_order_total(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_recalculate_order_total() RETURNS trigger
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


ALTER FUNCTION public.fn_recalculate_order_total() OWNER TO postgres;

--
-- Name: fn_update_order_status_on_payment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_update_order_status_on_payment() RETURNS trigger
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
                    UPDATE orders SET status_id = v_new_status_id, updated_at = now() WHERE order_id = NEW.order_id;
                END IF;
            ELSIF LOWER(NEW.status) = 'failed' THEN
                SELECT status_id INTO v_new_status_id FROM order_statuses WHERE code = 'canceled' LIMIT 1;
                IF v_new_status_id IS NOT NULL THEN
                    UPDATE orders SET status_id = v_new_status_id, updated_at = now() WHERE order_id = NEW.order_id;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.fn_update_order_status_on_payment() OWNER TO postgres;

--
-- Name: sp_add_product(character varying, text, numeric, integer, text, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sp_add_product(p_name_product character varying, p_description text, p_price numeric, p_weight_grams integer, p_photo_url text, p_category_name character varying, p_manufacturer_name character varying, p_sku character varying) RETURNS integer
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


ALTER FUNCTION public.sp_add_product(p_name_product character varying, p_description text, p_price numeric, p_weight_grams integer, p_photo_url text, p_category_name character varying, p_manufacturer_name character varying, p_sku character varying) OWNER TO postgres;

--
-- Name: sp_create_order(integer, integer, json); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sp_create_order(p_user_id integer, p_address_id integer, p_items json) RETURNS integer
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


ALTER FUNCTION public.sp_create_order(p_user_id integer, p_address_id integer, p_items json) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.addresses (
    address_id integer NOT NULL,
    user_id integer,
    city character varying(100) NOT NULL,
    street character varying(200) NOT NULL,
    house character varying(50) NOT NULL,
    apartment character varying(50),
    postal_code character varying(20),
    full_name character varying(150),
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.addresses OWNER TO postgres;

--
-- Name: addresses_address_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.addresses_address_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.addresses_address_id_seq OWNER TO postgres;

--
-- Name: addresses_address_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.addresses_address_id_seq OWNED BY public.addresses.address_id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    audit_id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    action character varying(50) NOT NULL,
    user_id integer,
    target_type character varying(20),
    target_id integer,
    target_name character varying(255),
    details jsonb,
    severity character varying(10) DEFAULT 'LOW'::character varying,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    before_data jsonb,
    after_data jsonb,
    CONSTRAINT audit_logs_severity_check CHECK (((severity)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying])::text[])))
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_audit_id_seq OWNER TO postgres;

--
-- Name: audit_logs_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_audit_id_seq OWNED BY public.audit_logs.audit_id;


--
-- Name: backups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backups (
    backup_id integer NOT NULL,
    filename character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size_mb numeric(10,2) NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    description text,
    is_automatic boolean DEFAULT false
);


ALTER TABLE public.backups OWNER TO postgres;

--
-- Name: backups_backup_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.backups_backup_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.backups_backup_id_seq OWNER TO postgres;

--
-- Name: backups_backup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.backups_backup_id_seq OWNED BY public.backups.backup_id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    category_id integer NOT NULL,
    name_categories character varying(150) NOT NULL,
    description text
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_category_id_seq OWNER TO postgres;

--
-- Name: categories_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_category_id_seq OWNED BY public.categories.category_id;


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedback (
    feedback_id integer NOT NULL,
    user_id integer,
    topic character varying(200),
    message_feedback text NOT NULL,
    email character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'new'::character varying
);


ALTER TABLE public.feedback OWNER TO postgres;

--
-- Name: feedback_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feedback_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feedback_feedback_id_seq OWNER TO postgres;

--
-- Name: feedback_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feedback_feedback_id_seq OWNED BY public.feedback.feedback_id;


--
-- Name: manufacturers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturers (
    manufacturer_id integer NOT NULL,
    name_manufacturers character varying(150) NOT NULL,
    description text
);


ALTER TABLE public.manufacturers OWNER TO postgres;

--
-- Name: manufacturers_manufacturer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.manufacturers_manufacturer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.manufacturers_manufacturer_id_seq OWNER TO postgres;

--
-- Name: manufacturers_manufacturer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.manufacturers_manufacturer_id_seq OWNED BY public.manufacturers.manufacturer_id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    order_item_id integer NOT NULL,
    order_id integer,
    product_id integer,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL,
    CONSTRAINT order_items_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_order_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_order_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_order_item_id_seq OWNER TO postgres;

--
-- Name: order_items_order_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_order_item_id_seq OWNED BY public.order_items.order_item_id;


--
-- Name: order_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_statuses (
    status_id integer NOT NULL,
    code character varying(50) NOT NULL,
    name_orderstatuses character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.order_statuses OWNER TO postgres;

--
-- Name: order_statuses_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_statuses_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_statuses_status_id_seq OWNER TO postgres;

--
-- Name: order_statuses_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_statuses_status_id_seq OWNED BY public.order_statuses.status_id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    order_id integer NOT NULL,
    user_id integer,
    address_id integer,
    status_id integer NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    delivery_method character varying(100),
    payment_method character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT orders_total_amount_check CHECK ((total_amount >= (0)::numeric))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_order_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_order_id_seq OWNER TO postgres;

--
-- Name: orders_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_order_id_seq OWNED BY public.orders.order_id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    payment_id integer NOT NULL,
    order_id integer,
    amount numeric(12,2) NOT NULL,
    method_payments character varying(100) NOT NULL,
    status character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payments_amount_check CHECK ((amount >= (0)::numeric))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payments_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payments_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_payment_id_seq OWNER TO postgres;

--
-- Name: payments_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payments_payment_id_seq OWNED BY public.payments.payment_id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    product_id integer NOT NULL,
    name_product character varying(200) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    weight_grams integer NOT NULL,
    photo_url text,
    category_id integer,
    manufacturer_id integer,
    sku character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT products_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT products_weight_grams_check CHECK ((weight_grams >= 0))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_product_id_seq OWNER TO postgres;

--
-- Name: products_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_product_id_seq OWNED BY public.products.product_id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    review_id integer NOT NULL,
    product_id integer,
    user_id integer,
    rating integer NOT NULL,
    comment_reviews text,
    created_at timestamp with time zone DEFAULT now(),
    is_visible boolean DEFAULT true,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: reviews_review_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reviews_review_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reviews_review_id_seq OWNER TO postgres;

--
-- Name: reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reviews_review_id_seq OWNED BY public.reviews.review_id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    role_id integer NOT NULL,
    name_role character varying(50) NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_role_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_role_id_seq OWNER TO postgres;

--
-- Name: roles_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_role_id_seq OWNED BY public.roles.role_id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id integer NOT NULL,
    role_id integer NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO postgres;

--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- Name: v_audit_logs_readable; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_audit_logs_readable AS
 SELECT a.audit_id,
    a."timestamp" AS event_ts,
    a.action AS action_type,
    a.severity,
    a.target_type,
    a.target_id,
    a.target_name,
    a.ip_address,
    a.user_agent,
    a.details,
    a.before_data,
    a.after_data,
    u.user_id AS actor_id,
    (((u.first_name)::text || ' '::text) || (u.last_name)::text) AS actor_name,
    u.email AS actor_email,
    a.created_at
   FROM (public.audit_logs a
     LEFT JOIN public.users u ON ((a.user_id = u.user_id)))
  ORDER BY a."timestamp" DESC;


ALTER VIEW public.v_audit_logs_readable OWNER TO postgres;

--
-- Name: v_audit_latest_100; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_audit_latest_100 AS
 SELECT audit_id,
    event_ts,
    action_type,
    severity,
    target_type,
    target_id,
    target_name,
    ip_address,
    user_agent,
    details,
    before_data,
    after_data,
    actor_id,
    actor_name,
    actor_email,
    created_at
   FROM public.v_audit_logs_readable
 LIMIT 100;


ALTER VIEW public.v_audit_latest_100 OWNER TO postgres;

--
-- Name: addresses address_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses ALTER COLUMN address_id SET DEFAULT nextval('public.addresses_address_id_seq'::regclass);


--
-- Name: audit_logs audit_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN audit_id SET DEFAULT nextval('public.audit_logs_audit_id_seq'::regclass);


--
-- Name: backups backup_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backups ALTER COLUMN backup_id SET DEFAULT nextval('public.backups_backup_id_seq'::regclass);


--
-- Name: categories category_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN category_id SET DEFAULT nextval('public.categories_category_id_seq'::regclass);


--
-- Name: feedback feedback_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback ALTER COLUMN feedback_id SET DEFAULT nextval('public.feedback_feedback_id_seq'::regclass);


--
-- Name: manufacturers manufacturer_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturers ALTER COLUMN manufacturer_id SET DEFAULT nextval('public.manufacturers_manufacturer_id_seq'::regclass);


--
-- Name: order_items order_item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN order_item_id SET DEFAULT nextval('public.order_items_order_item_id_seq'::regclass);


--
-- Name: order_statuses status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_statuses ALTER COLUMN status_id SET DEFAULT nextval('public.order_statuses_status_id_seq'::regclass);


--
-- Name: orders order_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN order_id SET DEFAULT nextval('public.orders_order_id_seq'::regclass);


--
-- Name: payments payment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN payment_id SET DEFAULT nextval('public.payments_payment_id_seq'::regclass);


--
-- Name: products product_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN product_id SET DEFAULT nextval('public.products_product_id_seq'::regclass);


--
-- Name: reviews review_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews ALTER COLUMN review_id SET DEFAULT nextval('public.reviews_review_id_seq'::regclass);


--
-- Name: roles role_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN role_id SET DEFAULT nextval('public.roles_role_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.addresses (address_id, user_id, city, street, house, apartment, postal_code, full_name, is_default, created_at) FROM stdin;
1	1	Москва	Тверская	10	5	101000	Иван Иванов	f	2025-10-14 19:50:20.339887+03
7	1	Москва	Тверская	19	45	101000	Иванов Иван Иванович	f	2025-10-14 19:51:39.946976+03
8	1	Москва	Тверская	14	45	141000	Иванов Иван Иванович	f	2025-10-14 19:58:53.310894+03
9	1	Москва	Тверская	24	43	141444	Иванов Иван Иванович	f	2025-10-14 19:59:39.672147+03
10	1	Москва	Тверская	15	49	141414	Иванов Иван Иванович	f	2025-10-14 20:09:09.835407+03
11	1	Москва	Тверская	11	45	101111	Иванов Иван Иванович	f	2025-10-15 11:52:52.180781+03
12	1	Тула	Кукушкина	12	47	232222	Никита Никита Никита	f	2025-10-15 11:56:53.608038+03
13	1	Тула	Куева	24	467	555555	Иванов Иван Иванович	f	2025-10-15 11:57:50.995957+03
14	1	Курск	Да	2143	41341	545555	Эмиль Эмиль Эмиль	f	2025-10-15 12:00:31.019706+03
15	1	Троицк	Текстильщиков	13	2	144666	Да да да	f	2025-10-15 12:14:23.270508+03
16	4	Курск	Кукушкина 	14	50	505352	Никита Никита Никита	f	2025-10-17 17:50:32.490847+03
17	4	Москва	Тверская	15	48	101000	\N	f	2025-10-17 17:55:16.253412+03
20	5	Тула	Алабуга	15	\N	777777	\N	f	2025-10-17 18:22:40.735216+03
22	5	Элабуга	Эгагуга	12	12	777777	\N	f	2025-10-17 18:31:46.691172+03
23	5	Москва	Дадада	56	56	466546	\N	f	2025-10-17 18:39:22.484067+03
24	5	ЕЕЕЕЕЕЕЕЕЕЕЕЕ	еееееееееееееееее	5454	\N	000000	\N	f	2025-10-17 18:45:27.495257+03
25	5	Да	Ее	49	49	888888	\N	f	2025-10-17 18:52:47.027647+03
26	5	Москва	Уцурюрю	69	69	131232	\N	f	2025-10-17 19:54:27.56343+03
27	5	Троицк	Дымовая	90	90	656656	\N	f	2025-10-17 23:57:44.128221+03
28	4	Москва	Куева	90	90	398434	\N	f	2025-10-19 01:25:29.85737+03
29	13	Москва	Тверская	15	\N	656566	\N	f	2025-10-19 17:39:56.647569+03
30	5	Москва	Тверская	49	49	584958	\N	f	2025-10-19 23:37:35.282411+03
31	5	Москва	Караганда	90	90	553229	\N	f	2025-10-20 12:48:03.671296+03
32	18	Москва	Сладкая	123	\N	\N	\N	f	2025-10-20 14:44:08.098773+03
33	18	Москва	Кыргызстанская 	54	\N	443898	\N	f	2025-10-20 14:46:17.696869+03
34	18	Москва	Сладкая	123	\N	\N	\N	f	2025-10-20 20:34:24.609762+03
35	18	Москва	Сладкая	123	\N	\N	\N	f	2025-10-20 21:55:18.889792+03
36	18	Москва	Сладкая	123	\N	\N	\N	f	2025-10-21 11:40:34.770335+03
37	17	Троицк	Куева	43	\N	555555	\N	f	2025-10-21 14:01:40.313173+03
38	20	Москва	Кукушкина	90	90	342424	\N	f	2025-10-21 14:13:12.785923+03
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (audit_id, "timestamp", action, user_id, target_type, target_id, target_name, details, severity, ip_address, user_agent, created_at, before_data, after_data) FROM stdin;
1	2025-10-19 22:20:35.326957+03	INSERT	\N	USERS	15	свжд ввадзадаз	{"table": "users", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-19 22:20:35.326957+03	\N	{"email": "dfafk@mail.ru", "user_id": 15, "last_name": "ввадзадаз", "created_at": "2025-10-19T22:20:35.326957+03:00", "first_name": "свжд"}
2	2025-10-19 22:20:35.398602+03	CREATE_USER	1	USER	15	свжд ввадзадаз	{"role": "client", "email": "dfafk@mail.ru", "method": "admin_creation", "createdBy": "admin"}	MEDIUM	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 22:20:35.398602+03	\N	\N
3	2025-10-19 22:21:37.248649+03	DELETE	\N	USERS	15	свжд ввадзадаз	{"table": "users", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-19 22:21:37.248649+03	{"email": "dfafk@mail.ru", "user_id": 15, "last_name": "ввадзадаз", "created_at": "2025-10-19T22:20:35.326957+03:00", "first_name": "свжд"}	\N
4	2025-10-19 22:21:37.282746+03	DELETE_USER	1	USER	15	undefined undefined	{"deletedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 22:21:37.282746+03	\N	\N
5	2025-10-19 22:21:58.479373+03	INSERT	\N	USERS	16	dsdasfa adfafa	{"table": "users", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-19 22:21:58.479373+03	\N	{"email": "dadadad@mail.ru", "user_id": 16, "last_name": "adfafa", "created_at": "2025-10-19T22:21:58.479373+03:00", "first_name": "dsdasfa"}
6	2025-10-19 22:21:58.560887+03	CREATE_USER	1	USER	16	dsdasfa adfafa	{"role": "client", "email": "dadadad@mail.ru", "method": "admin_creation", "createdBy": "admin"}	MEDIUM	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 22:21:58.560887+03	\N	\N
7	2025-10-19 22:22:02.837124+03	DELETE	\N	USERS	16	dsdasfa adfafa	{"table": "users", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-19 22:22:02.837124+03	{"email": "dadadad@mail.ru", "user_id": 16, "last_name": "adfafa", "created_at": "2025-10-19T22:21:58.479373+03:00", "first_name": "dsdasfa"}	\N
8	2025-10-19 22:22:02.865281+03	DELETE_USER	1	USER	16	undefined undefined	{"deletedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 22:22:02.865281+03	\N	\N
9	2025-10-19 23:26:46.160512+03	INSERT	\N	PRODUCTS	7	\N	{"table": "products", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-19 23:26:46.160512+03	\N	{"sku": "DSA342", "price": 734128.00, "photo_url": "/images/product-1760905606077-282929286.jpg", "created_at": "2025-10-19T23:26:46.160512+03:00", "product_id": 7, "category_id": 2, "description": "jdiajdasijdsii", "name_product": "iadjaidjasjii", "weight_grams": 4143, "manufacturer_id": 1}
10	2025-10-19 23:26:46.171709+03	CREATE_PRODUCT	1	PRODUCT	7	iadjaidjasjii	{"name": "iadjaidjasjii", "price": "734128.00", "category": "Конфеты", "manufacturer": "Сладкая Фабрика"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 23:26:46.171709+03	\N	\N
11	2025-10-19 23:30:05.407463+03	DELETE	\N	PRODUCTS	7	\N	{"table": "products", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-19 23:30:05.407463+03	{"sku": "DSA342", "price": 734128.00, "photo_url": "/images/product-1760905606077-282929286.jpg", "created_at": "2025-10-19T23:26:46.160512+03:00", "product_id": 7, "category_id": 2, "description": "jdiajdasijdsii", "name_product": "iadjaidjasjii", "weight_grams": 4143, "manufacturer_id": 1}	\N
12	2025-10-19 23:30:05.443785+03	DELETE_PRODUCT	1	PRODUCT	7	iadjaidjasjii	{"newValues": null, "oldValues": {"name": "iadjaidjasjii", "price": "734128.00", "category": "Конфеты", "manufacturer": "Сладкая Фабрика"}}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 23:30:05.443785+03	\N	\N
13	2025-10-19 23:33:15.039996+03	INSERT	\N	PRODUCTS	8	\N	{"table": "products", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-19 23:33:15.039996+03	\N	{"sku": "D24DKW", "price": 999.00, "photo_url": "/images/product1760905994948.jpg", "created_at": "2025-10-19T23:33:15.039996+03:00", "product_id": 8, "category_id": 3, "description": "okoko", "name_product": ",l,l,l", "weight_grams": 2321, "manufacturer_id": 1}
14	2025-10-19 23:33:15.091442+03	CREATE_PRODUCT	1	PRODUCT	8	,l,l,l	{"name": ",l,l,l", "price": "999.00", "category": "Торты", "manufacturer": "Сладкая Фабрика"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 23:33:15.091442+03	\N	\N
15	2025-10-19 23:33:26.540815+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 23:33:26.540815+03	\N	\N
16	2025-10-19 23:33:41.643258+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 23:33:41.643258+03	\N	\N
17	2025-10-19 23:37:35.282411+03	INSERT	\N	ORDERS	11	\N	{"table": "orders", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-19 23:37:35.282411+03	\N	{"user_id": 5, "order_id": 11, "status_id": 1, "address_id": 30, "created_at": "2025-10-19T23:37:35.282411+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}
18	2025-10-19 23:37:35.282411+03	INSERT	\N	ORDER_ITEMS	37	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-19 23:37:35.282411+03	\N	{"price": 999.00, "order_id": 11, "quantity": 1, "product_id": 8, "order_item_id": 37}
19	2025-10-19 23:37:35.282411+03	UPDATE	\N	ORDERS	11	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-19 23:37:35.282411+03	{"user_id": 5, "order_id": 11, "status_id": 1, "address_id": 30, "created_at": "2025-10-19T23:37:35.282411+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}	{"user_id": 5, "order_id": 11, "status_id": 1, "address_id": 30, "created_at": "2025-10-19T23:37:35.282411+03:00", "total_amount": 1128.50, "payment_method": null, "delivery_method": null}
20	2025-10-19 23:37:35.282411+03	UPDATE	\N	ORDERS	11	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-19 23:37:35.282411+03	{"user_id": 5, "order_id": 11, "status_id": 1, "address_id": 30, "created_at": "2025-10-19T23:37:35.282411+03:00", "total_amount": 1128.50, "payment_method": null, "delivery_method": null}	{"user_id": 5, "order_id": 11, "status_id": 1, "address_id": 30, "created_at": "2025-10-19T23:37:35.282411+03:00", "total_amount": 1128.50, "payment_method": "sbp", "delivery_method": "courier"}
21	2025-10-19 23:37:35.304797+03	INSERT	\N	PAYMENTS	11	\N	{"table": "payments", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-19 23:37:35.304797+03	\N	{"amount": 1128.50, "status": "pending", "order_id": 11, "created_at": "2025-10-19T23:37:35.304797+03:00", "payment_id": 11, "method_payments": "sbp"}
22	2025-10-19 23:37:50.042207+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-19 23:37:50.042207+03	\N	\N
23	2025-10-20 12:00:44.912124+03	INSERT	\N	USERS	17	Карина Угабуга	{"table": "users", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 12:00:44.912124+03	\N	{"email": "alexander674sanek@mail.ru", "user_id": 17, "last_name": "Угабуга", "created_at": "2025-10-20T12:00:44.912124+03:00", "first_name": "Карина"}
24	2025-10-20 12:00:46.722246+03	CREATE_USER	17	USER	17	Карина Угабуга	{"role": "client", "email": "alexander674sanek@mail.ru", "method": "self_registration"}	MEDIUM	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:00:46.722246+03	\N	\N
25	2025-10-20 12:01:21.205948+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:01:21.205948+03	\N	\N
26	2025-10-20 12:02:25.54872+03	INSERT	\N	PRODUCTS	9	\N	{"table": "products", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 12:02:25.54872+03	\N	{"sku": "FDS4424D", "price": 434.00, "photo_url": "/images/product1760950945491.jpg", "created_at": "2025-10-20T12:02:25.54872+03:00", "product_id": 9, "category_id": 4, "description": "vjclvlvxl", "name_product": "бубайский шоколад", "weight_grams": 341, "manufacturer_id": 1}
27	2025-10-20 12:02:25.578319+03	CREATE_PRODUCT	1	PRODUCT	9	бубайский шоколад	{"name": "бубайский шоколад", "price": "434.00", "category": "Чизкейки", "manufacturer": "Сладкая Фабрика"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:02:25.578319+03	\N	\N
28	2025-10-20 12:02:37.169834+03	DELETE	\N	PRODUCTS	9	\N	{"table": "products", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-20 12:02:37.169834+03	{"sku": "FDS4424D", "price": 434.00, "photo_url": "/images/product1760950945491.jpg", "created_at": "2025-10-20T12:02:25.54872+03:00", "product_id": 9, "category_id": 4, "description": "vjclvlvxl", "name_product": "бубайский шоколад", "weight_grams": 341, "manufacturer_id": 1}	\N
29	2025-10-20 12:02:37.176395+03	DELETE_PRODUCT	1	PRODUCT	9	бубайский шоколад	{"newValues": null, "oldValues": {"name": "бубайский шоколад", "price": "434.00", "category": "Чизкейки", "manufacturer": "Сладкая Фабрика"}}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:02:37.176395+03	\N	\N
30	2025-10-20 12:02:50.935997+03	DELETE	\N	PRODUCTS	8	\N	{"table": "products", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-20 12:02:50.935997+03	{"sku": "D24DKW", "price": 999.00, "photo_url": "/images/product1760905994948.jpg", "created_at": "2025-10-19T23:33:15.039996+03:00", "product_id": 8, "category_id": 3, "description": "okoko", "name_product": ",l,l,l", "weight_grams": 2321, "manufacturer_id": 1}	\N
31	2025-10-20 12:02:50.961515+03	DELETE_PRODUCT	1	PRODUCT	8	,l,l,l	{"newValues": null, "oldValues": {"name": ",l,l,l", "price": "999.00", "category": "Торты", "manufacturer": "Сладкая Фабрика"}}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:02:50.961515+03	\N	\N
32	2025-10-20 12:08:20.446045+03	INSERT	\N	PRODUCTS	10	\N	{"table": "products", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 12:08:20.446045+03	\N	{"sku": "DAD73412", "price": 150.00, "photo_url": "/images/product1760951300379.jpg", "created_at": "2025-10-20T12:08:20.446045+03:00", "product_id": 10, "category_id": 3, "description": "аываыва", "name_product": "аывав", "weight_grams": 888, "manufacturer_id": 1}
33	2025-10-20 12:08:20.50112+03	CREATE_PRODUCT	1	PRODUCT	10	аывав	{"name": "аывав", "price": "150.00", "category": "Торты", "manufacturer": "Сладкая Фабрика"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:08:20.50112+03	\N	\N
34	2025-10-20 12:08:37.138316+03	DELETE	\N	PRODUCTS	10	\N	{"table": "products", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-20 12:08:37.138316+03	{"sku": "DAD73412", "price": 150.00, "photo_url": "/images/product1760951300379.jpg", "created_at": "2025-10-20T12:08:20.446045+03:00", "product_id": 10, "category_id": 3, "description": "аываыва", "name_product": "аывав", "weight_grams": 888, "manufacturer_id": 1}	\N
35	2025-10-20 12:08:37.166318+03	DELETE_PRODUCT	1	PRODUCT	10	аывав	{"newValues": null, "oldValues": {"name": "аывав", "price": "150.00", "category": "Торты", "manufacturer": "Сладкая Фабрика"}}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:08:37.166318+03	\N	\N
37	2025-10-20 12:15:30.314028+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:15:30.314028+03	\N	\N
39	2025-10-20 12:32:48.209402+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:32:48.209402+03	\N	\N
40	2025-10-20 12:33:06.973748+03	DELETE	\N	ORDERS	11	\N	{"table": "orders", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-20 12:33:06.973748+03	{"user_id": 5, "order_id": 11, "status_id": 1, "address_id": 30, "created_at": "2025-10-19T23:37:35.282411+03:00", "total_amount": 1128.50, "payment_method": "sbp", "delivery_method": "courier"}	\N
41	2025-10-20 12:33:06.973748+03	DELETE	\N	PAYMENTS	11	\N	{"table": "payments", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-20 12:33:06.973748+03	{"amount": 1128.50, "status": "pending", "order_id": 11, "created_at": "2025-10-19T23:37:35.304797+03:00", "payment_id": 11, "method_payments": "sbp"}	\N
42	2025-10-20 12:33:49.479834+03	UPDATE	\N	ORDERS	1	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:33:49.479834+03	{"user_id": null, "order_id": 1, "status_id": 1, "address_id": 17, "created_at": "2025-10-17T17:55:16.253412+03:00", "total_amount": 129.50, "payment_method": "card", "delivery_method": "post"}	{"user_id": 5, "order_id": 1, "status_id": 1, "address_id": 17, "created_at": "2025-10-17T17:55:16.253412+03:00", "total_amount": 129.50, "payment_method": "card", "delivery_method": "post"}
36	2025-10-20 12:15:14.803842+03	LOGIN	\N	USER	7	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:15:14.803842+03	\N	\N
114	2025-10-20 13:58:14.084378+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:58:14.084378+03	{}	{}
115	2025-10-20 13:58:29.828087+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:58:29.828087+03	\N	\N
43	2025-10-20 12:33:49.479834+03	UPDATE	\N	ORDERS	9	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:33:49.479834+03	{"user_id": null, "order_id": 9, "status_id": 1, "address_id": 28, "created_at": "2025-10-19T01:25:29.85737+03:00", "total_amount": 1514.50, "payment_method": "card", "delivery_method": "pickup"}	{"user_id": 5, "order_id": 9, "status_id": 1, "address_id": 28, "created_at": "2025-10-19T01:25:29.85737+03:00", "total_amount": 1514.50, "payment_method": "card", "delivery_method": "pickup"}
44	2025-10-20 12:46:06.741145+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:46:06.741145+03	\N	\N
45	2025-10-20 12:47:29.674074+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:47:29.674074+03	\N	\N
46	2025-10-20 12:48:03.671296+03	INSERT	\N	ORDERS	12	\N	{"table": "orders", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 12:48:03.671296+03	\N	{"user_id": 5, "order_id": 12, "status_id": 1, "address_id": 31, "created_at": "2025-10-20T12:48:03.671296+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}
47	2025-10-20 12:48:03.671296+03	INSERT	\N	ORDER_ITEMS	38	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 12:48:03.671296+03	\N	{"price": 219.00, "order_id": 12, "quantity": 1, "product_id": 5, "order_item_id": 38}
48	2025-10-20 12:48:03.671296+03	UPDATE	\N	ORDERS	12	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:48:03.671296+03	{"user_id": 5, "order_id": 12, "status_id": 1, "address_id": 31, "created_at": "2025-10-20T12:48:03.671296+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}	{"user_id": 5, "order_id": 12, "status_id": 1, "address_id": 31, "created_at": "2025-10-20T12:48:03.671296+03:00", "total_amount": 348.50, "payment_method": null, "delivery_method": null}
49	2025-10-20 12:48:03.671296+03	UPDATE	\N	ORDERS	12	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:48:03.671296+03	{"user_id": 5, "order_id": 12, "status_id": 1, "address_id": 31, "created_at": "2025-10-20T12:48:03.671296+03:00", "total_amount": 348.50, "payment_method": null, "delivery_method": null}	{"user_id": 5, "order_id": 12, "status_id": 1, "address_id": 31, "created_at": "2025-10-20T12:48:03.671296+03:00", "total_amount": 348.50, "payment_method": "sbp", "delivery_method": "courier"}
50	2025-10-20 12:48:03.695835+03	INSERT	\N	PAYMENTS	12	\N	{"table": "payments", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 12:48:03.695835+03	\N	{"amount": 348.50, "status": "paid", "order_id": 12, "created_at": "2025-10-20T12:48:03.695835+03:00", "payment_id": 12, "method_payments": "sbp"}
51	2025-10-20 12:48:28.711666+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:48:28.711666+03	\N	\N
52	2025-10-20 12:49:27.210023+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:49:27.210023+03	\N	\N
53	2025-10-20 12:50:26.519832+03	CHANGE_ROLE	1	USER	17	undefined undefined	{"newRole": "manager", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:50:26.519832+03	\N	\N
54	2025-10-20 12:50:29.786463+03	CHANGE_ROLE	1	USER	17	undefined undefined	{"newRole": "client", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:50:29.786463+03	\N	\N
55	2025-10-20 12:50:42.689795+03	UPDATE	\N	USERS	1	Admi User	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:50:42.689795+03	{"email": "emilka560@mail.ru", "user_id": 1, "last_name": "User", "created_at": "2025-10-17T16:51:27.318115+03:00", "first_name": "Admin"}	{"email": "emilka560@mail.ru", "user_id": 1, "last_name": "User", "created_at": "2025-10-17T16:51:27.318115+03:00", "first_name": "Admi"}
56	2025-10-20 12:51:03.593412+03	UPDATE	\N	USERS	1	Admin User	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:51:03.593412+03	{"email": "emilka560@mail.ru", "user_id": 1, "last_name": "User", "created_at": "2025-10-17T16:51:27.318115+03:00", "first_name": "Admi"}	{"email": "emilka560@mail.ru", "user_id": 1, "last_name": "User", "created_at": "2025-10-17T16:51:27.318115+03:00", "first_name": "Admin"}
58	2025-10-20 12:51:27.960392+03	UPDATE	\N	USERS	7	Ильk Шишаев	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:51:27.960392+03	{"email": "kenshi326@mail.ru", "user_id": 7, "last_name": "Шишаев", "created_at": "2025-10-19T03:54:15.434334+03:00", "first_name": "Илья"}	{"email": "kenshi326@mail.ru", "user_id": 7, "last_name": "Шишаев", "created_at": "2025-10-19T03:54:15.434334+03:00", "first_name": "Ильk"}
59	2025-10-20 12:51:35.97825+03	UPDATE	\N	USERS	7	Илья Шишаев	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:51:35.97825+03	{"email": "kenshi326@mail.ru", "user_id": 7, "last_name": "Шишаев", "created_at": "2025-10-19T03:54:15.434334+03:00", "first_name": "Ильk"}	{"email": "kenshi326@mail.ru", "user_id": 7, "last_name": "Шишаев", "created_at": "2025-10-19T03:54:15.434334+03:00", "first_name": "Илья"}
60	2025-10-20 12:51:43.712825+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:51:43.712825+03	\N	\N
61	2025-10-20 12:54:32.61997+03	UPDATE	\N	PRODUCTS	5	\N	{"table": "products", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:54:32.61997+03	{"sku": "BC300", "price": 219.00, "photo_url": "C:\\\\Users\\\\Lenovo\\\\shop\\\\first-site\\\\public\\\\images\\\\sweet8.jpg", "created_at": "2025-10-07T16:41:15.585625+03:00", "product_id": 5, "category_id": 4, "description": "Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.", "name_product": "Чизкейк «Red Velvet Oreo»", "weight_grams": 300, "manufacturer_id": 1}	{"sku": "BC300", "price": 200.00, "photo_url": "/images/sweet8.jpg", "created_at": "2025-10-07T16:41:15.585625+03:00", "product_id": 5, "category_id": 4, "description": "Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.", "name_product": "Чизкейк «Red Velvet Oreo»", "weight_grams": 300, "manufacturer_id": 1}
62	2025-10-20 12:54:32.660796+03	UPDATE_PRODUCT	1	PRODUCT	5	Чизкейк «Red Velvet Oreo»	{"newValues": {"name": "Чизкейк «Red Velvet Oreo»", "price": "200.00", "category": "Чизкейки", "manufacturer": "Сладкая Фабрика"}, "oldValues": {"name": "Чизкейк «Red Velvet Oreo»", "price": "219.00", "category": "Чизкейки", "manufacturer": "Сладкая Фабрика"}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:54:32.660796+03	\N	\N
63	2025-10-20 12:54:43.019735+03	UPDATE	\N	PRODUCTS	5	\N	{"table": "products", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 12:54:43.019735+03	{"sku": "BC300", "price": 200.00, "photo_url": "/images/sweet8.jpg", "created_at": "2025-10-07T16:41:15.585625+03:00", "product_id": 5, "category_id": 4, "description": "Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.", "name_product": "Чизкейк «Red Velvet Oreo»", "weight_grams": 300, "manufacturer_id": 1}	{"sku": "BC300", "price": 199.99, "photo_url": "/images/sweet8.jpg", "created_at": "2025-10-07T16:41:15.585625+03:00", "product_id": 5, "category_id": 4, "description": "Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.", "name_product": "Чизкейк «Red Velvet Oreo»", "weight_grams": 300, "manufacturer_id": 1}
64	2025-10-20 12:54:43.023396+03	UPDATE_PRODUCT	1	PRODUCT	5	Чизкейк «Red Velvet Oreo»	{"newValues": {"name": "Чизкейк «Red Velvet Oreo»", "price": "199.99", "category": "Чизкейки", "manufacturer": "Сладкая Фабрика"}, "oldValues": {"name": "Чизкейк «Red Velvet Oreo»", "price": "200.00", "category": "Чизкейки", "manufacturer": "Сладкая Фабрика"}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:54:43.023396+03	\N	\N
65	2025-10-20 12:59:45.721681+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:59:45.721681+03	\N	\N
66	2025-10-20 13:00:10.87982+03	CHANGE_ROLE	1	USER	17	undefined undefined	{"newRole": "manager", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:00:10.87982+03	\N	\N
67	2025-10-20 13:00:14.651689+03	CHANGE_ROLE	1	USER	17	undefined undefined	{"newRole": "client", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:00:14.651689+03	\N	\N
68	2025-10-20 13:08:14.019884+03	UPDATE	\N	USERS	13	Алексей Панфилов	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:08:14.019884+03	{"email": "nikita560@mail.ru", "user_id": 13, "last_name": "Панфилов", "created_at": "2025-10-19T17:38:56.58522+03:00", "first_name": "Никита"}	{"email": "nikita560@mail.ru", "user_id": 13, "last_name": "Панфилов", "created_at": "2025-10-19T17:38:56.58522+03:00", "first_name": "Алексей"}
69	2025-10-20 13:08:14.053616+03	UPDATE_PROFILE	13	USER	13	Алексей Панфилов	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:08:14.053616+03	\N	\N
38	2025-10-20 12:32:37.164931+03	LOGIN	\N	USER	7	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:32:37.164931+03	\N	\N
57	2025-10-20 12:51:14.427748+03	LOGIN	\N	USER	7	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 12:51:14.427748+03	\N	\N
70	2025-10-20 13:09:55.030837+03	LOGIN	\N	USER	7	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:09:55.030837+03	\N	\N
71	2025-10-20 13:10:27.689601+03	DELETE	\N	USERS	7	Илья Шишаев	{"table": "users", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-20 13:10:27.689601+03	{"email": "kenshi326@mail.ru", "user_id": 7, "last_name": "Шишаев", "created_at": "2025-10-19T03:54:15.434334+03:00", "first_name": "Илья"}	\N
72	2025-10-20 13:10:27.754871+03	DELETE_USER	1	USER	7	undefined undefined	{"deletedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:10:27.754871+03	\N	\N
73	2025-10-20 13:10:50.971049+03	INSERT	\N	USERS	18	Илья Иоанев	{"table": "users", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 13:10:50.971049+03	\N	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Илья"}
74	2025-10-20 13:10:52.305051+03	CREATE_USER	18	USER	18	Илья Иоанев	{"role": "client", "email": "kenshi326@mail.ru", "method": "self_registration"}	MEDIUM	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:10:52.305051+03	\N	\N
75	2025-10-20 13:15:13.666099+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:15:13.666099+03	\N	\N
76	2025-10-20 13:15:21.116694+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:15:21.116694+03	\N	\N
77	2025-10-20 13:15:54.515974+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:15:54.515974+03	\N	\N
78	2025-10-20 13:16:00.410115+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:16:00.410115+03	\N	\N
79	2025-10-20 13:16:15.390726+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:16:15.390726+03	\N	\N
80	2025-10-20 13:16:37.377911+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:16:37.377911+03	\N	\N
116	2025-10-20 13:58:36.36943+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:58:36.36943+03	{}	{}
81	2025-10-20 13:16:58.644173+03	UPDATE	\N	USERS	13	Никита Панфилов	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:16:58.644173+03	{"email": "nikita560@mail.ru", "user_id": 13, "last_name": "Панфилов", "created_at": "2025-10-19T17:38:56.58522+03:00", "first_name": "Алексей"}	{"email": "nikita560@mail.ru", "user_id": 13, "last_name": "Панфилов", "created_at": "2025-10-19T17:38:56.58522+03:00", "first_name": "Никита"}
82	2025-10-20 13:16:58.685523+03	UPDATE_PROFILE	13	USER	13	Никита Панфилов	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:16:58.685523+03	\N	\N
83	2025-10-20 13:18:21.562566+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:18:21.562566+03	\N	\N
84	2025-10-20 13:18:36.242089+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:18:36.242089+03	\N	\N
85	2025-10-20 13:18:53.078376+03	UPDATE	\N	USERS	18	Илья Иоанев	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:18:53.078376+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Илья"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Илья"}
86	2025-10-20 13:18:54.43663+03	UPDATE_PROFILE	18	USER	18	Илья Иоанев	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:18:54.43663+03	\N	\N
87	2025-10-20 13:18:54.451221+03	CHANGE_PASSWORD	18	USER	18	Илья Иоанев	{"byUser": true}	MEDIUM	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:18:54.451221+03	\N	\N
88	2025-10-20 13:19:00.290725+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:19:00.290725+03	\N	\N
89	2025-10-20 13:19:04.644289+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:19:04.644289+03	\N	\N
90	2025-10-20 13:20:05.898623+03	CHANGE_ROLE	1	USER	18	undefined undefined	{"newRole": "manager", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:20:05.898623+03	\N	\N
91	2025-10-20 13:20:11.368124+03	CHANGE_ROLE	1	USER	18	undefined undefined	{"newRole": "client", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:20:11.368124+03	\N	\N
92	2025-10-20 13:24:32.646122+03	UPDATE	\N	USERS	18	фвывф Иоанев	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:24:32.646122+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Илья"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "фвывф"}
93	2025-10-20 13:24:32.689079+03	UPDATE_PROFILE	18	USER	18	фвывф Иоанев	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:24:32.689079+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Илья"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "фвывф"}
94	2025-10-20 13:27:49.624834+03	UPDATE	\N	USERS	18	Илья Иоанев	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:27:49.624834+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "фвывф"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Илья"}
95	2025-10-20 13:27:49.635863+03	UPDATE_PROFILE	18	USER	18	Илья Иоанев	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:27:49.635863+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "фвывф"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Илья"}
96	2025-10-20 13:29:25.247998+03	CHANGE_ROLE	1	USER	18	undefined undefined	{"newRole": "manager", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:29:25.247998+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Илья"}	{"role": "manager", "user_id": 18}
97	2025-10-20 13:36:41.963366+03	UPDATE	\N	USERS	18	Артем Иоанев	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:36:41.963366+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Илья"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Артем"}
98	2025-10-20 13:36:42.008361+03	UPDATE_PROFILE	18	USER	18	Артем Иоанев	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:36:42.008361+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Илья"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Артем"}
99	2025-10-20 13:36:42.036949+03	CHANGE_ROLE	1	USER	18	Артем Иоанев	{"newRole": "client", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:36:42.036949+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Артем"}	{"role": "client", "user_id": 18}
117	2025-10-20 13:58:39.451256+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:58:39.451256+03	\N	\N
118	2025-10-20 13:58:45.784347+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:58:45.784347+03	{}	{}
100	2025-10-20 13:43:41.508735+03	UPDATE	\N	PRODUCTS	5	\N	{"table": "products", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:43:41.508735+03	{"sku": "BC300", "price": 199.99, "photo_url": "/images/sweet8.jpg", "created_at": "2025-10-07T16:41:15.585625+03:00", "product_id": 5, "category_id": 4, "description": "Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.", "name_product": "Чизкейк «Red Velvet Oreo»", "weight_grams": 300, "manufacturer_id": 1}	{"sku": "BC300", "price": 209.99, "photo_url": "/images/sweet8.jpg", "created_at": "2025-10-07T16:41:15.585625+03:00", "product_id": 5, "category_id": 4, "description": "Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.", "name_product": "Чизкейк «Red Velvet Oreo»", "weight_grams": 300, "manufacturer_id": 1}
101	2025-10-20 13:43:41.523654+03	UPDATE_PRODUCT	1	PRODUCT	5	Чизкейк «Red Velvet Oreo»	{"newValues": {"name": "Чизкейк «Red Velvet Oreo»", "price": "209.99", "category": "Чизкейки", "manufacturer": "Сладкая Фабрика"}, "oldValues": {"name": "Чизкейк «Red Velvet Oreo»", "price": "199.99", "category": "Чизкейки", "manufacturer": "Сладкая Фабрика"}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:43:41.523654+03	{"sku": "BC300", "price": "199.99", "photo_url": "/images/sweet8.jpg", "product_id": 5, "description": "Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.", "name_product": "Чизкейк «Red Velvet Oreo»", "weight_grams": 300, "category_name": "Чизкейки", "manufacturer_name": "Сладкая Фабрика"}	{"sku": "BC300", "price": "209.99", "photo_url": "/images/sweet8.jpg", "product_id": 5, "description": "Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.", "name_product": "Чизкейк «Red Velvet Oreo»", "weight_grams": 300, "category_name": "Чизкейки", "manufacturer_name": "Сладкая Фабрика"}
102	2025-10-20 13:53:29.734135+03	UPDATE	\N	USERS	18	Илья Иоанев	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:53:29.734135+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Артем"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Илья"}
103	2025-10-20 13:53:29.783447+03	UPDATE_PROFILE	18	USER	18	Илья Иоанев	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:53:29.783447+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Артем"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Илья"}
104	2025-10-20 13:56:07.500393+03	UPDATE	\N	USERS	18	Аулег Иоанев	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:56:07.500393+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Илья"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Аулег"}
105	2025-10-20 13:56:07.534736+03	UPDATE_PROFILE	18	USER	18	Аулег Иоанев	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:56:07.534736+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Илья"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Аулег"}
106	2025-10-20 13:56:56.348917+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:56:56.348917+03	{}	{}
107	2025-10-20 13:57:00.230883+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:57:00.230883+03	\N	\N
108	2025-10-20 13:57:11.855683+03	UPDATE	\N	USERS	5	Владимир Егоров	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:57:11.855683+03	{"email": "hodzahove@gmail.com", "user_id": 5, "last_name": "Егоров", "created_at": "2025-10-17T17:18:32.314296+03:00", "first_name": "Егор"}	{"email": "hodzahove@gmail.com", "user_id": 5, "last_name": "Егоров", "created_at": "2025-10-17T17:18:32.314296+03:00", "first_name": "Владимир"}
109	2025-10-20 13:57:11.904458+03	UPDATE_PROFILE	5	USER	5	Владимир Егоров	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:57:11.904458+03	{"email": "hodzahove@gmail.com", "user_id": 5, "last_name": "Егоров", "first_name": "Егор"}	{"email": "hodzahove@gmail.com", "user_id": 5, "last_name": "Егоров", "first_name": "Владимир"}
110	2025-10-20 13:57:15.965484+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:57:15.965484+03	{}	{}
111	2025-10-20 13:57:21.080769+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:57:21.080769+03	\N	\N
112	2025-10-20 13:57:53.303129+03	UPDATE	\N	USERS	18	Олег Иоанев	{"table": "users", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 13:57:53.303129+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Аулег"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "created_at": "2025-10-20T13:10:50.971049+03:00", "first_name": "Олег"}
113	2025-10-20 13:57:53.308731+03	UPDATE_USER	1	USER	18	Олег Иоанев	{"updatedFields": {"last_name": true, "first_name": true}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:57:53.308731+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Аулег"}	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Олег"}
119	2025-10-20 13:58:49.842906+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 13:58:49.842906+03	\N	\N
120	2025-10-20 14:03:52.285199+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:03:52.285199+03	{}	{}
121	2025-10-20 14:03:56.420868+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:03:56.420868+03	\N	\N
122	2025-10-20 14:07:11.136175+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:07:11.136175+03	{}	{}
123	2025-10-20 14:07:16.441122+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:07:16.441122+03	\N	\N
124	2025-10-20 14:12:40.377214+03	UPDATE	\N	ORDERS	12	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:12:40.377214+03	{"user_id": 5, "order_id": 12, "status_id": 1, "address_id": 31, "created_at": "2025-10-20T12:48:03.671296+03:00", "total_amount": 348.50, "payment_method": "sbp", "delivery_method": "courier"}	{"user_id": 5, "order_id": 12, "status_id": 2, "address_id": 31, "created_at": "2025-10-20T12:48:03.671296+03:00", "total_amount": 348.50, "payment_method": "sbp", "delivery_method": "courier"}
125	2025-10-20 14:13:02.304998+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:13:02.304998+03	{}	{}
126	2025-10-20 14:13:06.773464+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:13:06.773464+03	\N	\N
127	2025-10-20 14:13:24.273022+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:13:24.273022+03	{}	{}
128	2025-10-20 14:13:28.847185+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:13:28.847185+03	\N	\N
129	2025-10-20 14:16:43.40002+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:16:43.40002+03	{}	{}
130	2025-10-20 14:16:49.828391+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:16:49.828391+03	\N	\N
131	2025-10-20 14:17:31.498025+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:17:31.498025+03	{}	{}
132	2025-10-20 14:17:36.477793+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:17:36.477793+03	\N	\N
133	2025-10-20 14:21:07.176449+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:21:07.176449+03	{}	{}
134	2025-10-20 14:21:12.625123+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:21:12.625123+03	\N	\N
135	2025-10-20 14:21:31.446771+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:21:31.446771+03	{}	{}
136	2025-10-20 14:21:34.894066+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:21:34.894066+03	\N	\N
137	2025-10-20 14:44:08.098773+03	INSERT	\N	ORDERS	13	\N	{"table": "orders", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 14:44:08.098773+03	\N	{"user_id": 18, "order_id": 13, "status_id": 1, "address_id": 32, "created_at": "2025-10-20T14:44:08.098773+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}
138	2025-10-20 14:44:08.098773+03	INSERT	\N	ORDER_ITEMS	39	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 14:44:08.098773+03	\N	{"price": 149.00, "order_id": 13, "quantity": 1, "product_id": 3, "order_item_id": 39}
139	2025-10-20 14:44:08.098773+03	UPDATE	\N	ORDERS	13	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:44:08.098773+03	{"user_id": 18, "order_id": 13, "status_id": 1, "address_id": 32, "created_at": "2025-10-20T14:44:08.098773+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 13, "status_id": 1, "address_id": 32, "created_at": "2025-10-20T14:44:08.098773+03:00", "total_amount": 338.00, "payment_method": null, "delivery_method": null}
140	2025-10-20 14:44:08.098773+03	UPDATE	\N	ORDERS	13	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:44:08.098773+03	{"user_id": 18, "order_id": 13, "status_id": 1, "address_id": 32, "created_at": "2025-10-20T14:44:08.098773+03:00", "total_amount": 338.00, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 13, "status_id": 1, "address_id": 32, "created_at": "2025-10-20T14:44:08.098773+03:00", "total_amount": 338.00, "payment_method": "meet", "delivery_method": "pickup"}
141	2025-10-20 14:44:08.117417+03	INSERT	\N	PAYMENTS	13	\N	{"table": "payments", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 14:44:08.117417+03	\N	{"amount": 338.00, "status": "pending", "order_id": 13, "created_at": "2025-10-20T14:44:08.117417+03:00", "payment_id": 13, "method_payments": "cod"}
142	2025-10-20 14:46:17.696869+03	INSERT	\N	ORDERS	14	\N	{"table": "orders", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 14:46:17.696869+03	\N	{"user_id": 18, "order_id": 14, "status_id": 1, "address_id": 33, "created_at": "2025-10-20T14:46:17.696869+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}
143	2025-10-20 14:46:17.696869+03	INSERT	\N	ORDER_ITEMS	40	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 14:46:17.696869+03	\N	{"price": 189.00, "order_id": 14, "quantity": 1, "product_id": 6, "order_item_id": 40}
160	2025-10-20 14:47:39.055047+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:47:39.055047+03	{}	{}
144	2025-10-20 14:46:17.696869+03	UPDATE	\N	ORDERS	14	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:46:17.696869+03	{"user_id": 18, "order_id": 14, "status_id": 1, "address_id": 33, "created_at": "2025-10-20T14:46:17.696869+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 14, "status_id": 1, "address_id": 33, "created_at": "2025-10-20T14:46:17.696869+03:00", "total_amount": 388.50, "payment_method": null, "delivery_method": null}
145	2025-10-20 14:46:17.696869+03	UPDATE	\N	ORDERS	14	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:46:17.696869+03	{"user_id": 18, "order_id": 14, "status_id": 1, "address_id": 33, "created_at": "2025-10-20T14:46:17.696869+03:00", "total_amount": 388.50, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 14, "status_id": 1, "address_id": 33, "created_at": "2025-10-20T14:46:17.696869+03:00", "total_amount": 388.50, "payment_method": "sbp", "delivery_method": "courier"}
146	2025-10-20 14:46:17.717223+03	INSERT	\N	PAYMENTS	14	\N	{"table": "payments", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 14:46:17.717223+03	\N	{"amount": 388.50, "status": "paid", "order_id": 14, "created_at": "2025-10-20T14:46:17.717223+03:00", "payment_id": 14, "method_payments": "sbp"}
147	2025-10-20 14:46:30.634535+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:46:30.634535+03	{}	{}
148	2025-10-20 14:46:35.859368+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:46:35.859368+03	\N	\N
149	2025-10-20 14:47:02.291645+03	UPDATE	\N	ORDERS	14	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:47:02.291645+03	{"user_id": 18, "order_id": 14, "status_id": 1, "address_id": 33, "created_at": "2025-10-20T14:46:17.696869+03:00", "total_amount": 388.50, "payment_method": "sbp", "delivery_method": "courier"}	{"user_id": 18, "order_id": 14, "status_id": 3, "address_id": 33, "created_at": "2025-10-20T14:46:17.696869+03:00", "total_amount": 388.50, "payment_method": "sbp", "delivery_method": "courier"}
150	2025-10-20 14:47:04.194042+03	UPDATE	\N	ORDERS	13	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:47:04.194042+03	{"user_id": 18, "order_id": 13, "status_id": 1, "address_id": 32, "created_at": "2025-10-20T14:44:08.098773+03:00", "total_amount": 338.00, "payment_method": "meet", "delivery_method": "pickup"}	{"user_id": 18, "order_id": 13, "status_id": 5, "address_id": 32, "created_at": "2025-10-20T14:44:08.098773+03:00", "total_amount": 338.00, "payment_method": "meet", "delivery_method": "pickup"}
151	2025-10-20 14:47:06.758494+03	UPDATE	\N	ORDERS	8	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:47:06.758494+03	{"user_id": 5, "order_id": 8, "status_id": 1, "address_id": 27, "created_at": "2025-10-17T23:57:44.128221+03:00", "total_amount": 1514.50, "payment_method": "meet", "delivery_method": "pickup"}	{"user_id": 5, "order_id": 8, "status_id": 2, "address_id": 27, "created_at": "2025-10-17T23:57:44.128221+03:00", "total_amount": 1514.50, "payment_method": "meet", "delivery_method": "pickup"}
152	2025-10-20 14:47:08.845705+03	UPDATE	\N	ORDERS	9	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:47:08.845705+03	{"user_id": 5, "order_id": 9, "status_id": 1, "address_id": 28, "created_at": "2025-10-19T01:25:29.85737+03:00", "total_amount": 1514.50, "payment_method": "card", "delivery_method": "pickup"}	{"user_id": 5, "order_id": 9, "status_id": 3, "address_id": 28, "created_at": "2025-10-19T01:25:29.85737+03:00", "total_amount": 1514.50, "payment_method": "card", "delivery_method": "pickup"}
153	2025-10-20 14:47:11.003013+03	UPDATE	\N	ORDERS	10	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:47:11.003013+03	{"user_id": 13, "order_id": 10, "status_id": 1, "address_id": 29, "created_at": "2025-10-19T17:39:56.647569+03:00", "total_amount": 348.50, "payment_method": "card", "delivery_method": "courier"}	{"user_id": 13, "order_id": 10, "status_id": 4, "address_id": 29, "created_at": "2025-10-19T17:39:56.647569+03:00", "total_amount": 348.50, "payment_method": "card", "delivery_method": "courier"}
154	2025-10-20 14:47:12.725906+03	UPDATE	\N	ORDERS	6	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:47:12.725906+03	{"user_id": 5, "order_id": 6, "status_id": 1, "address_id": 25, "created_at": "2025-10-17T18:52:47.027647+03:00", "total_amount": 329.00, "payment_method": "card", "delivery_method": "pickup"}	{"user_id": 5, "order_id": 6, "status_id": 2, "address_id": 25, "created_at": "2025-10-17T18:52:47.027647+03:00", "total_amount": 329.00, "payment_method": "card", "delivery_method": "pickup"}
155	2025-10-20 14:47:14.513561+03	UPDATE	\N	ORDERS	7	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:47:14.513561+03	{"user_id": 5, "order_id": 7, "status_id": 1, "address_id": 26, "created_at": "2025-10-17T19:54:27.56343+03:00", "total_amount": 996.50, "payment_method": "card", "delivery_method": "pickup"}	{"user_id": 5, "order_id": 7, "status_id": 5, "address_id": 26, "created_at": "2025-10-17T19:54:27.56343+03:00", "total_amount": 996.50, "payment_method": "card", "delivery_method": "pickup"}
156	2025-10-20 14:47:16.417274+03	UPDATE	\N	ORDERS	4	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:47:16.417274+03	{"user_id": 5, "order_id": 4, "status_id": 1, "address_id": 23, "created_at": "2025-10-17T18:39:22.484067+03:00", "total_amount": 129.50, "payment_method": "card", "delivery_method": "pickup"}	{"user_id": 5, "order_id": 4, "status_id": 2, "address_id": 23, "created_at": "2025-10-17T18:39:22.484067+03:00", "total_amount": 129.50, "payment_method": "card", "delivery_method": "pickup"}
157	2025-10-20 14:47:18.450614+03	UPDATE	\N	ORDERS	1	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 14:47:18.450614+03	{"user_id": 5, "order_id": 1, "status_id": 1, "address_id": 17, "created_at": "2025-10-17T17:55:16.253412+03:00", "total_amount": 129.50, "payment_method": "card", "delivery_method": "post"}	{"user_id": 5, "order_id": 1, "status_id": 2, "address_id": 17, "created_at": "2025-10-17T17:55:16.253412+03:00", "total_amount": 129.50, "payment_method": "card", "delivery_method": "post"}
158	2025-10-20 14:47:22.891224+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:47:22.891224+03	{}	{}
159	2025-10-20 14:47:28.027533+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:47:28.027533+03	\N	\N
161	2025-10-20 14:47:43.659463+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:47:43.659463+03	\N	\N
162	2025-10-20 14:47:50.978681+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:47:50.978681+03	{}	{}
163	2025-10-20 14:47:55.374145+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:47:55.374145+03	\N	\N
164	2025-10-20 14:48:13.306917+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:48:13.306917+03	{}	{}
165	2025-10-20 14:48:17.252957+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:48:17.252957+03	\N	\N
166	2025-10-20 14:51:44.118321+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:51:44.118321+03	{}	{}
167	2025-10-20 14:51:48.403273+03	LOGIN	5	USER	5	undefined undefined	{"email": "hodzahove@gmail.com"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:51:48.403273+03	\N	\N
168	2025-10-20 14:54:20.515891+03	LOGOUT	5	USER	5	User 5	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:54:20.515891+03	{}	{}
169	2025-10-20 14:54:25.847894+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:54:25.847894+03	\N	\N
170	2025-10-20 14:57:55.848183+03	INSERT	\N	USERS	19	Евгений  Непартов	{"table": "users", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 14:57:55.848183+03	\N	{"email": "neparta@mail.ru", "user_id": 19, "last_name": "Непартов", "created_at": "2025-10-20T14:57:55.848183+03:00", "first_name": "Евгений "}
171	2025-10-20 14:57:55.945599+03	CREATE_USER	1	USER	19	Евгений  Непартов	{"role": "manager", "email": "neparta@mail.ru", "method": "admin_creation", "createdBy": "admin"}	MEDIUM	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:57:55.945599+03	\N	\N
172	2025-10-20 14:57:58.89137+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:57:58.89137+03	{}	{}
173	2025-10-20 14:58:01.827331+03	LOGIN	19	USER	19	undefined undefined	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:58:01.827331+03	\N	\N
174	2025-10-20 14:58:07.526849+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:58:07.526849+03	{}	{}
175	2025-10-20 14:58:13.479948+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:58:13.479948+03	\N	\N
176	2025-10-20 14:59:36.873173+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 14:59:36.873173+03	{}	{}
177	2025-10-20 15:04:30.460198+03	LOGIN	19	USER	19	undefined undefined	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 15:04:30.460198+03	\N	\N
178	2025-10-20 15:09:08.73482+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 15:09:08.73482+03	{}	{}
179	2025-10-20 15:09:16.029173+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 15:09:16.029173+03	\N	\N
180	2025-10-20 15:09:19.042338+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 15:09:19.042338+03	{}	{}
181	2025-10-20 15:09:23.824218+03	LOGIN	19	USER	19	undefined undefined	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 15:09:23.824218+03	\N	\N
182	2025-10-20 20:31:51.894912+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:31:51.894912+03	{}	{}
183	2025-10-20 20:33:14.267247+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:33:14.267247+03	\N	\N
184	2025-10-20 20:33:16.637464+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:33:16.637464+03	{}	{}
185	2025-10-20 20:33:28.86728+03	LOGIN	19	USER	19	undefined undefined	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:33:28.86728+03	\N	\N
186	2025-10-20 20:33:56.167677+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:33:56.167677+03	{}	{}
187	2025-10-20 20:34:00.875137+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:34:00.875137+03	\N	\N
188	2025-10-20 20:34:24.609762+03	INSERT	\N	ORDERS	15	\N	{"table": "orders", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 20:34:24.609762+03	\N	{"user_id": 18, "order_id": 15, "status_id": 1, "address_id": 34, "created_at": "2025-10-20T20:34:24.609762+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}
189	2025-10-20 20:34:24.609762+03	INSERT	\N	ORDER_ITEMS	41	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 20:34:24.609762+03	\N	{"price": 199.50, "order_id": 15, "quantity": 1, "product_id": 1, "order_item_id": 41}
214	2025-10-20 21:41:19.592957+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:41:19.592957+03	\N	\N
190	2025-10-20 20:34:24.609762+03	UPDATE	\N	ORDERS	15	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 20:34:24.609762+03	{"user_id": 18, "order_id": 15, "status_id": 1, "address_id": 34, "created_at": "2025-10-20T20:34:24.609762+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 15, "status_id": 1, "address_id": 34, "created_at": "2025-10-20T20:34:24.609762+03:00", "total_amount": 418.50, "payment_method": null, "delivery_method": null}
191	2025-10-20 20:34:24.609762+03	INSERT	\N	ORDER_ITEMS	42	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 20:34:24.609762+03	\N	{"price": 209.99, "order_id": 15, "quantity": 1, "product_id": 5, "order_item_id": 42}
192	2025-10-20 20:34:24.609762+03	UPDATE	\N	ORDERS	15	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 20:34:24.609762+03	{"user_id": 18, "order_id": 15, "status_id": 1, "address_id": 34, "created_at": "2025-10-20T20:34:24.609762+03:00", "total_amount": 418.50, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 15, "status_id": 1, "address_id": 34, "created_at": "2025-10-20T20:34:24.609762+03:00", "total_amount": 628.49, "payment_method": null, "delivery_method": null}
193	2025-10-20 20:34:24.609762+03	INSERT	\N	ORDER_ITEMS	43	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 20:34:24.609762+03	\N	{"price": 149.00, "order_id": 15, "quantity": 1, "product_id": 3, "order_item_id": 43}
194	2025-10-20 20:34:24.609762+03	UPDATE	\N	ORDERS	15	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 20:34:24.609762+03	{"user_id": 18, "order_id": 15, "status_id": 1, "address_id": 34, "created_at": "2025-10-20T20:34:24.609762+03:00", "total_amount": 628.49, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 15, "status_id": 1, "address_id": 34, "created_at": "2025-10-20T20:34:24.609762+03:00", "total_amount": 777.49, "payment_method": null, "delivery_method": null}
195	2025-10-20 20:34:24.609762+03	UPDATE	\N	ORDERS	15	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 20:34:24.609762+03	{"user_id": 18, "order_id": 15, "status_id": 1, "address_id": 34, "created_at": "2025-10-20T20:34:24.609762+03:00", "total_amount": 777.49, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 15, "status_id": 1, "address_id": 34, "created_at": "2025-10-20T20:34:24.609762+03:00", "total_amount": 777.49, "payment_method": "meet", "delivery_method": "pickup"}
196	2025-10-20 20:34:24.639051+03	INSERT	\N	PAYMENTS	15	\N	{"table": "payments", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 20:34:24.639051+03	\N	{"amount": 777.49, "status": "pending", "order_id": 15, "created_at": "2025-10-20T20:34:24.639051+03:00", "payment_id": 15, "method_payments": "cod"}
197	2025-10-20 20:34:36.750072+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:34:36.750072+03	{}	{}
198	2025-10-20 20:34:40.537084+03	LOGIN	19	USER	19	undefined undefined	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:34:40.537084+03	\N	\N
199	2025-10-20 20:39:22.422301+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:39:22.422301+03	{}	{}
200	2025-10-20 20:39:32.619186+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:39:32.619186+03	\N	\N
201	2025-10-20 20:46:44.042708+03	CHANGE_ROLE	1	USER	18	Олег Иоанев	{"newRole": "manager", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:46:44.042708+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Олег"}	{"role": "manager", "user_id": 18}
202	2025-10-20 20:46:48.411506+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:46:48.411506+03	{}	{}
203	2025-10-20 20:46:53.281047+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:46:53.281047+03	\N	\N
204	2025-10-20 20:47:00.1771+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:47:00.1771+03	{}	{}
205	2025-10-20 20:47:06.923141+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:47:06.923141+03	\N	\N
206	2025-10-20 20:47:15.369782+03	CHANGE_ROLE	1	USER	18	Олег Иоанев	{"newRole": "client", "changedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:47:15.369782+03	{"email": "kenshi326@mail.ru", "user_id": 18, "last_name": "Иоанев", "first_name": "Олег"}	{"role": "client", "user_id": 18}
207	2025-10-20 20:47:28.128179+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:47:28.128179+03	{}	{}
208	2025-10-20 20:47:36.18294+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:47:36.18294+03	\N	\N
209	2025-10-20 20:47:44.36001+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:47:44.36001+03	{}	{}
210	2025-10-20 20:47:58.397037+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 20:47:58.397037+03	\N	\N
211	2025-10-20 21:04:36.831583+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 CrKey/1.54.248666	2025-10-20 21:04:36.831583+03	{}	{}
212	2025-10-20 21:04:43.782083+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 CrKey/1.54.248666	2025-10-20 21:04:43.782083+03	\N	\N
213	2025-10-20 21:41:15.685589+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:41:15.685589+03	{}	{}
215	2025-10-20 21:53:56.436312+03	INSERT	\N	PRODUCTS	11	\N	{"table": "products", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 21:53:56.436312+03	\N	{"sku": "DSAD342", "price": 300.00, "photo_url": "/images/product1760986436382.jpg", "created_at": "2025-10-20T21:53:56.436312+03:00", "product_id": 11, "category_id": 1, "description": "Вкусный шоколад оч", "name_product": "Шоколад", "weight_grams": 150, "manufacturer_id": 1}
216	2025-10-20 21:53:56.44991+03	CREATE_PRODUCT	1	PRODUCT	11	Шоколад	{"name": "Шоколад", "price": "300.00", "category": "Шоколад", "manufacturer": "Сладкая Фабрика"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:53:56.44991+03	\N	\N
217	2025-10-20 21:54:48.167109+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:54:48.167109+03	{}	{}
218	2025-10-20 21:54:52.702481+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:54:52.702481+03	\N	\N
219	2025-10-20 21:55:18.889792+03	INSERT	\N	ORDERS	16	\N	{"table": "orders", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 21:55:18.889792+03	\N	{"user_id": 18, "order_id": 16, "status_id": 1, "address_id": 35, "created_at": "2025-10-20T21:55:18.889792+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}
220	2025-10-20 21:55:18.889792+03	INSERT	\N	ORDER_ITEMS	44	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 21:55:18.889792+03	\N	{"price": 129.50, "order_id": 16, "quantity": 1, "product_id": 4, "order_item_id": 44}
221	2025-10-20 21:55:18.889792+03	UPDATE	\N	ORDERS	16	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 21:55:18.889792+03	{"user_id": 18, "order_id": 16, "status_id": 1, "address_id": 35, "created_at": "2025-10-20T21:55:18.889792+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 16, "status_id": 1, "address_id": 35, "created_at": "2025-10-20T21:55:18.889792+03:00", "total_amount": 129.50, "payment_method": null, "delivery_method": null}
222	2025-10-20 21:55:18.889792+03	INSERT	\N	ORDER_ITEMS	45	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 21:55:18.889792+03	\N	{"price": 300.00, "order_id": 16, "quantity": 1, "product_id": 11, "order_item_id": 45}
223	2025-10-20 21:55:18.889792+03	UPDATE	\N	ORDERS	16	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 21:55:18.889792+03	{"user_id": 18, "order_id": 16, "status_id": 1, "address_id": 35, "created_at": "2025-10-20T21:55:18.889792+03:00", "total_amount": 129.50, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 16, "status_id": 1, "address_id": 35, "created_at": "2025-10-20T21:55:18.889792+03:00", "total_amount": 429.50, "payment_method": null, "delivery_method": null}
224	2025-10-20 21:55:18.889792+03	UPDATE	\N	ORDERS	16	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-20 21:55:18.889792+03	{"user_id": 18, "order_id": 16, "status_id": 1, "address_id": 35, "created_at": "2025-10-20T21:55:18.889792+03:00", "total_amount": 429.50, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 16, "status_id": 1, "address_id": 35, "created_at": "2025-10-20T21:55:18.889792+03:00", "total_amount": 429.50, "payment_method": "meet", "delivery_method": "pickup"}
225	2025-10-20 21:55:18.906663+03	INSERT	\N	PAYMENTS	16	\N	{"table": "payments", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-20 21:55:18.906663+03	\N	{"amount": 429.50, "status": "pending", "order_id": 16, "created_at": "2025-10-20T21:55:18.906663+03:00", "payment_id": 16, "method_payments": "cod"}
226	2025-10-20 21:55:33.828812+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:55:33.828812+03	{}	{}
227	2025-10-20 21:55:38.036148+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:55:38.036148+03	\N	\N
228	2025-10-20 21:55:42.702549+03	DELETE	\N	PRODUCTS	11	\N	{"table": "products", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-20 21:55:42.702549+03	{"sku": "DSAD342", "price": 300.00, "photo_url": "/images/product1760986436382.jpg", "created_at": "2025-10-20T21:53:56.436312+03:00", "product_id": 11, "category_id": 1, "description": "Вкусный шоколад оч", "name_product": "Шоколад", "weight_grams": 150, "manufacturer_id": 1}	\N
229	2025-10-20 21:55:42.733797+03	DELETE_PRODUCT	1	PRODUCT	11	Шоколад	{"newValues": null, "oldValues": {"name": "Шоколад", "price": "300.00", "category": "Шоколад", "manufacturer": "Сладкая Фабрика"}}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:55:42.733797+03	\N	\N
230	2025-10-20 21:55:50.564779+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:55:50.564779+03	{}	{}
231	2025-10-20 21:55:55.007347+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 21:55:55.007347+03	\N	\N
232	2025-10-20 22:30:23.928227+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 22:30:23.928227+03	{}	{}
233	2025-10-20 22:30:28.961527+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 22:30:28.961527+03	\N	\N
234	2025-10-20 22:34:45.85284+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 22:34:45.85284+03	{}	{}
235	2025-10-20 22:34:50.29301+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 22:34:50.29301+03	\N	\N
236	2025-10-20 22:36:57.16292+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 22:36:57.16292+03	{}	{}
237	2025-10-20 22:37:00.757348+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 22:37:00.757348+03	\N	\N
238	2025-10-20 23:01:22.719351+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:01:22.719351+03	{}	{}
239	2025-10-20 23:01:25.517646+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:01:25.517646+03	\N	\N
240	2025-10-20 23:02:37.151661+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:02:37.151661+03	{}	{}
241	2025-10-20 23:02:40.36803+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:02:40.36803+03	\N	\N
242	2025-10-20 23:05:16.794526+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:05:16.794526+03	{}	{}
243	2025-10-20 23:05:19.633793+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:05:19.633793+03	\N	\N
244	2025-10-20 23:05:26.120585+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:05:26.120585+03	{}	{}
245	2025-10-20 23:05:30.420912+03	LOGIN	18	USER	18	undefined undefined	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:05:30.420912+03	\N	\N
246	2025-10-20 23:05:33.60985+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:05:33.60985+03	{}	{}
247	2025-10-20 23:05:37.903744+03	LOGIN	1	USER	1	undefined undefined	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:05:37.903744+03	\N	\N
248	2025-10-20 23:07:38.004128+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:07:38.004128+03	{}	{}
249	2025-10-20 23:07:40.042371+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:07:40.042371+03	\N	\N
250	2025-10-20 23:07:45.391953+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:07:45.391953+03	{}	{}
251	2025-10-20 23:07:48.403144+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:07:48.403144+03	\N	\N
252	2025-10-20 23:07:49.1757+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:07:49.1757+03	{}	{}
253	2025-10-20 23:07:55.337143+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:07:55.337143+03	\N	\N
254	2025-10-20 23:31:18.484156+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:31:18.484156+03	{}	{}
255	2025-10-20 23:31:21.868975+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:31:21.868975+03	\N	\N
256	2025-10-20 23:46:25.284706+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:46:25.284706+03	{}	{}
257	2025-10-20 23:47:00.593399+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:47:00.593399+03	\N	\N
258	2025-10-20 23:47:39.608844+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:47:39.608844+03	{}	{}
259	2025-10-20 23:47:59.81683+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:47:59.81683+03	\N	\N
260	2025-10-20 23:48:03.563747+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:48:03.563747+03	{}	{}
261	2025-10-20 23:48:07.858973+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:48:07.858973+03	\N	\N
262	2025-10-20 23:48:10.742633+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:48:10.742633+03	{}	{}
263	2025-10-20 23:48:15.804674+03	LOGIN	19	USER	19	Евгений  Непартов	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:48:15.804674+03	\N	\N
264	2025-10-20 23:53:08.970756+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:53:08.970756+03	{}	{}
265	2025-10-20 23:53:24.360239+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:53:24.360239+03	\N	\N
266	2025-10-20 23:53:55.623004+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:53:55.623004+03	{}	{}
267	2025-10-20 23:54:00.737627+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-20 23:54:00.737627+03	\N	\N
268	2025-10-21 00:05:34.93062+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:05:34.93062+03	{}	{}
269	2025-10-21 00:05:38.778962+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:05:38.778962+03	\N	\N
270	2025-10-21 00:05:41.113932+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:05:41.113932+03	{}	{}
271	2025-10-21 00:05:46.649126+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:05:46.649126+03	\N	\N
272	2025-10-21 00:05:47.95592+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:05:47.95592+03	{}	{}
273	2025-10-21 00:05:52.851251+03	LOGIN	19	USER	19	Евгений  Непартов	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:05:52.851251+03	\N	\N
274	2025-10-21 00:05:55.123677+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:05:55.123677+03	{}	{}
275	2025-10-21 00:06:00.193267+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:06:00.193267+03	\N	\N
276	2025-10-21 00:30:02.304571+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:30:02.304571+03	{}	{}
277	2025-10-21 00:30:07.782933+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 00:30:07.782933+03	\N	\N
278	2025-10-21 10:25:09.132233+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:25:09.132233+03	{}	{}
279	2025-10-21 10:25:28.053151+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:25:28.053151+03	\N	\N
280	2025-10-21 10:26:11.071557+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:26:11.071557+03	{}	{}
281	2025-10-21 10:26:17.095555+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:26:17.095555+03	\N	\N
282	2025-10-21 10:32:44.489153+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:32:44.489153+03	{}	{}
283	2025-10-21 10:32:54.680654+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:32:54.680654+03	\N	\N
284	2025-10-21 10:37:15.968512+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:37:15.968512+03	{}	{}
285	2025-10-21 10:37:20.617481+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:37:20.617481+03	\N	\N
286	2025-10-21 10:40:03.586262+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:40:03.586262+03	{}	{}
287	2025-10-21 10:40:09.657969+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:40:09.657969+03	\N	\N
288	2025-10-21 10:48:43.421428+03	INSERT	\N	CATEGORIES	\N	\N	{"table": "categories", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 10:48:43.421428+03	\N	{"category_id": 6, "description": "Оч вкусные турецкие сладости", "name_categories": "Турецкие сладости"}
289	2025-10-21 10:48:43.525634+03	CREATE_CATEGORY	1	CATEGORY	6	Турецкие сладости	{"name": "Турецкие сладости", "description": "Оч вкусные турецкие сладости"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:48:43.525634+03	\N	\N
290	2025-10-21 10:53:08.857463+03	INSERT	\N	MANUFACTURERS	3	\N	{"table": "manufacturers", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 10:53:08.857463+03	\N	{"description": "Крутая фабрика для изготовления сладостей", "manufacturer_id": 3, "name_manufacturers": "АлабугаПолитех"}
291	2025-10-21 10:53:08.879419+03	CREATE_MANUFACTURER	1	MANUFACTURER	3	АлабугаПолитех	{"name": "АлабугаПолитех", "description": "Крутая фабрика для изготовления сладостей"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:53:08.879419+03	\N	\N
292	2025-10-21 10:54:56.289237+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:54:56.289237+03	{}	{}
293	2025-10-21 10:55:02.844331+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:55:02.844331+03	\N	\N
294	2025-10-21 10:55:12.651268+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:55:12.651268+03	{}	{}
295	2025-10-21 10:55:22.8736+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:55:22.8736+03	\N	\N
296	2025-10-21 10:55:26.629557+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:55:26.629557+03	{}	{}
297	2025-10-21 10:55:32.054571+03	LOGIN	19	USER	19	Евгений  Непартов	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:55:32.054571+03	\N	\N
298	2025-10-21 10:55:40.433424+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:55:40.433424+03	{}	{}
299	2025-10-21 10:55:45.66312+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:55:45.66312+03	\N	\N
300	2025-10-21 10:58:43.83541+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:58:43.83541+03	{}	{}
301	2025-10-21 10:59:56.710371+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 10:59:56.710371+03	\N	\N
302	2025-10-21 11:00:09.287098+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:00:09.287098+03	{}	{}
303	2025-10-21 11:00:14.732375+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:00:14.732375+03	\N	\N
304	2025-10-21 11:00:17.829967+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:00:17.829967+03	{}	{}
305	2025-10-21 11:00:22.382368+03	LOGIN	19	USER	19	Евгений  Непартов	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:00:22.382368+03	\N	\N
306	2025-10-21 11:00:32.626853+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:00:32.626853+03	{}	{}
307	2025-10-21 11:00:37.015817+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:00:37.015817+03	\N	\N
308	2025-10-21 11:07:53.929794+03	INSERT	\N	CATEGORIES	\N	\N	{"table": "categories", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 11:07:53.929794+03	\N	{"category_id": 7, "description": "Молочный шоколад оч вкусный", "name_categories": "Молочный шоколад"}
309	2025-10-21 11:07:53.93581+03	CREATE_CATEGORY	1	CATEGORY	7	Молочный шоколад	{"name": "Молочный шоколад", "description": "Молочный шоколад оч вкусный"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:07:53.93581+03	\N	\N
310	2025-10-21 11:08:16.095165+03	INSERT	\N	CATEGORIES	\N	\N	{"table": "categories", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 11:08:16.095165+03	\N	{"category_id": 8, "description": "Черный шоколад очень питателен", "name_categories": "Черный шоколад"}
311	2025-10-21 11:08:16.100493+03	CREATE_CATEGORY	1	CATEGORY	8	Черный шоколад	{"name": "Черный шоколад", "description": "Черный шоколад очень питателен"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:08:16.100493+03	\N	\N
312	2025-10-21 11:17:28.497997+03	INSERT	\N	PRODUCTS	12	\N	{"table": "products", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 11:17:28.497997+03	\N	{"sku": "TUR234KIS", "price": 100.00, "photo_url": "/images/product1761034648438.jpg", "created_at": "2025-10-21T11:17:28.497997+03:00", "product_id": 12, "category_id": 6, "description": "Крутые сладости с орехами прямиком из Турции.", "name_product": "Сладости с орехами", "weight_grams": 900, "manufacturer_id": 3}
313	2025-10-21 11:17:28.511252+03	CREATE_PRODUCT	1	PRODUCT	12	Сладости с орехами	{"name": "Сладости с орехами", "price": "100.00", "category": "Турецкие сладости", "manufacturer": "АлабугаПолитех"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:17:28.511252+03	\N	\N
314	2025-10-21 11:34:00.041708+03	UPDATE	\N	PRODUCTS	12	\N	{"table": "products", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 11:34:00.041708+03	{"sku": "TUR234KIS", "price": 100.00, "photo_url": "/images/product1761034648438.jpg", "created_at": "2025-10-21T11:17:28.497997+03:00", "product_id": 12, "category_id": 6, "description": "Крутые сладости с орехами прямиком из Турции.", "name_product": "Сладости с орехами", "weight_grams": 900, "manufacturer_id": 3}	{"sku": "TUR234KIS", "price": 100.00, "photo_url": "/images/product1761035639935.jpg", "created_at": "2025-10-21T11:17:28.497997+03:00", "product_id": 12, "category_id": 6, "description": "Крутые сладости с орехами прямиком из Турции.", "name_product": "Сладости с орехами", "weight_grams": 900, "manufacturer_id": 3}
315	2025-10-21 11:34:00.052707+03	UPDATE_PRODUCT	1	PRODUCT	12	Сладости с орехами	{"newValues": {"name": "Сладости с орехами", "price": "100.00", "category": "Турецкие сладости", "manufacturer": "АлабугаПолитех"}, "oldValues": {"name": "Сладости с орехами", "price": "100.00", "category": "Турецкие сладости", "manufacturer": "АлабугаПолитех"}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:34:00.052707+03	{"sku": "TUR234KIS", "price": "100.00", "photo_url": "/images/product1761034648438.jpg", "product_id": 12, "description": "Крутые сладости с орехами прямиком из Турции.", "name_product": "Сладости с орехами", "weight_grams": 900, "category_name": "Турецкие сладости", "manufacturer_name": "АлабугаПолитех"}	{"sku": "TUR234KIS", "price": "100.00", "photo_url": "/images/product1761035639935.jpg", "product_id": 12, "description": "Крутые сладости с орехами прямиком из Турции.", "name_product": "Сладости с орехами", "weight_grams": 900, "category_name": "Турецкие сладости", "manufacturer_name": "АлабугаПолитех"}
334	2025-10-21 11:40:34.770335+03	UPDATE	\N	ORDERS	17	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 11:40:34.770335+03	{"user_id": 18, "order_id": 17, "status_id": 1, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 409.49, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 17, "status_id": 1, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 409.49, "payment_method": "meet", "delivery_method": "pickup"}
316	2025-10-21 11:34:11.046639+03	UPDATE	\N	PRODUCTS	12	\N	{"table": "products", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 11:34:11.046639+03	{"sku": "TUR234KIS", "price": 100.00, "photo_url": "/images/product1761035639935.jpg", "created_at": "2025-10-21T11:17:28.497997+03:00", "product_id": 12, "category_id": 6, "description": "Крутые сладости с орехами прямиком из Турции.", "name_product": "Сладости с орехами", "weight_grams": 900, "manufacturer_id": 3}	{"sku": "TUR234KIS", "price": 100.00, "photo_url": "/images/product1761035650983.jpg", "created_at": "2025-10-21T11:17:28.497997+03:00", "product_id": 12, "category_id": 6, "description": "Крутые сладости с орехами прямиком из Турции.", "name_product": "Сладости с орехами", "weight_grams": 900, "manufacturer_id": 3}
317	2025-10-21 11:34:11.078229+03	UPDATE_PRODUCT	1	PRODUCT	12	Сладости с орехами	{"newValues": {"name": "Сладости с орехами", "price": "100.00", "category": "Турецкие сладости", "manufacturer": "АлабугаПолитех"}, "oldValues": {"name": "Сладости с орехами", "price": "100.00", "category": "Турецкие сладости", "manufacturer": "АлабугаПолитех"}}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:34:11.078229+03	{"sku": "TUR234KIS", "price": "100.00", "photo_url": "/images/product1761035639935.jpg", "product_id": 12, "description": "Крутые сладости с орехами прямиком из Турции.", "name_product": "Сладости с орехами", "weight_grams": 900, "category_name": "Турецкие сладости", "manufacturer_name": "АлабугаПолитех"}	{"sku": "TUR234KIS", "price": "100.00", "photo_url": "/images/product1761035650983.jpg", "product_id": 12, "description": "Крутые сладости с орехами прямиком из Турции.", "name_product": "Сладости с орехами", "weight_grams": 900, "category_name": "Турецкие сладости", "manufacturer_name": "АлабугаПолитех"}
318	2025-10-21 11:34:39.578007+03	INSERT	\N	PRODUCTS	13	\N	{"table": "products", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 11:34:39.578007+03	\N	{"sku": null, "price": 2.00, "photo_url": "/images/product1761035679502.jpg", "created_at": "2025-10-21T11:34:39.578007+03:00", "product_id": 13, "category_id": 8, "description": "фывфыв", "name_product": "фывфывфыв", "weight_grams": 2, "manufacturer_id": 1}
319	2025-10-21 11:34:39.616939+03	CREATE_PRODUCT	1	PRODUCT	13	фывфывфыв	{"name": "фывфывфыв", "price": "2.00", "category": "Черный шоколад", "manufacturer": "Сладкая Фабрика"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:34:39.616939+03	\N	\N
320	2025-10-21 11:34:45.843798+03	DELETE	\N	PRODUCTS	13	\N	{"table": "products", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-21 11:34:45.843798+03	{"sku": null, "price": 2.00, "photo_url": "/images/product1761035679502.jpg", "created_at": "2025-10-21T11:34:39.578007+03:00", "product_id": 13, "category_id": 8, "description": "фывфыв", "name_product": "фывфывфыв", "weight_grams": 2, "manufacturer_id": 1}	\N
321	2025-10-21 11:34:45.845675+03	DELETE_PRODUCT	1	PRODUCT	13	фывфывфыв	{"newValues": null, "oldValues": {"name": "фывфывфыв", "price": "2.00", "category": "Черный шоколад", "manufacturer": "Сладкая Фабрика"}}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:34:45.845675+03	\N	\N
322	2025-10-21 11:35:48.426763+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:35:48.426763+03	{}	{}
323	2025-10-21 11:35:57.185181+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:35:57.185181+03	\N	\N
324	2025-10-21 11:36:11.047214+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:36:11.047214+03	{}	{}
325	2025-10-21 11:36:18.340848+03	LOGIN	19	USER	19	Евгений  Непартов	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:36:18.340848+03	\N	\N
326	2025-10-21 11:36:43.460426+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:36:43.460426+03	{}	{}
327	2025-10-21 11:36:43.476656+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:36:43.476656+03	{}	{}
328	2025-10-21 11:37:14.785066+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:37:14.785066+03	\N	\N
329	2025-10-21 11:40:34.770335+03	INSERT	\N	ORDERS	17	\N	{"table": "orders", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 11:40:34.770335+03	\N	{"user_id": 18, "order_id": 17, "status_id": 1, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}
330	2025-10-21 11:40:34.770335+03	INSERT	\N	ORDER_ITEMS	46	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 11:40:34.770335+03	\N	{"price": 209.99, "order_id": 17, "quantity": 1, "product_id": 5, "order_item_id": 46}
331	2025-10-21 11:40:34.770335+03	UPDATE	\N	ORDERS	17	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 11:40:34.770335+03	{"user_id": 18, "order_id": 17, "status_id": 1, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 17, "status_id": 1, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 209.99, "payment_method": null, "delivery_method": null}
332	2025-10-21 11:40:34.770335+03	INSERT	\N	ORDER_ITEMS	47	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 11:40:34.770335+03	\N	{"price": 199.50, "order_id": 17, "quantity": 1, "product_id": 1, "order_item_id": 47}
333	2025-10-21 11:40:34.770335+03	UPDATE	\N	ORDERS	17	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 11:40:34.770335+03	{"user_id": 18, "order_id": 17, "status_id": 1, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 209.99, "payment_method": null, "delivery_method": null}	{"user_id": 18, "order_id": 17, "status_id": 1, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 409.49, "payment_method": null, "delivery_method": null}
335	2025-10-21 11:40:34.794685+03	INSERT	\N	PAYMENTS	17	\N	{"table": "payments", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 11:40:34.794685+03	\N	{"amount": 409.49, "status": "pending", "order_id": 17, "created_at": "2025-10-21T11:40:34.794685+03:00", "payment_id": 17, "method_payments": "cod"}
336	2025-10-21 11:40:48.856201+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:40:48.856201+03	{}	{}
337	2025-10-21 11:40:52.622528+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:40:52.622528+03	\N	\N
338	2025-10-21 11:40:57.250962+03	UPDATE	\N	ORDERS	17	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 11:40:57.250962+03	{"user_id": 18, "order_id": 17, "status_id": 1, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 409.49, "payment_method": "meet", "delivery_method": "pickup"}	{"user_id": 18, "order_id": 17, "status_id": 3, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 409.49, "payment_method": "meet", "delivery_method": "pickup"}
339	2025-10-21 11:41:01.050273+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:41:01.050273+03	{}	{}
340	2025-10-21 11:41:04.439465+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 11:41:04.439465+03	\N	\N
341	2025-10-21 13:57:29.773042+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 13:57:29.773042+03	{}	{}
342	2025-10-21 13:57:37.849716+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 13:57:37.849716+03	\N	\N
343	2025-10-21 13:58:43.764034+03	UPDATE	\N	ORDERS	17	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 13:58:43.764034+03	{"user_id": 18, "order_id": 17, "status_id": 3, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 409.49, "payment_method": "meet", "delivery_method": "pickup"}	{"user_id": 18, "order_id": 17, "status_id": 4, "address_id": 36, "created_at": "2025-10-21T11:40:34.770335+03:00", "total_amount": 409.49, "payment_method": "meet", "delivery_method": "pickup"}
344	2025-10-21 13:59:04.594748+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 13:59:04.594748+03	{}	{}
345	2025-10-21 13:59:13.324593+03	LOGIN	17	USER	17	Карина Угабуга	{"email": "alexander674sanek@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 13:59:13.324593+03	\N	\N
346	2025-10-21 14:01:40.313173+03	INSERT	\N	ORDERS	18	\N	{"table": "orders", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 14:01:40.313173+03	\N	{"user_id": 17, "order_id": 18, "status_id": 1, "address_id": 37, "created_at": "2025-10-21T14:01:40.313173+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}
347	2025-10-21 14:01:40.313173+03	INSERT	\N	ORDER_ITEMS	48	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 14:01:40.313173+03	\N	{"price": 209.99, "order_id": 18, "quantity": 200, "product_id": 5, "order_item_id": 48}
348	2025-10-21 14:01:40.313173+03	UPDATE	\N	ORDERS	18	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 14:01:40.313173+03	{"user_id": 17, "order_id": 18, "status_id": 1, "address_id": 37, "created_at": "2025-10-21T14:01:40.313173+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}	{"user_id": 17, "order_id": 18, "status_id": 1, "address_id": 37, "created_at": "2025-10-21T14:01:40.313173+03:00", "total_amount": 41998.00, "payment_method": null, "delivery_method": null}
349	2025-10-21 14:01:40.313173+03	UPDATE	\N	ORDERS	18	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 14:01:40.313173+03	{"user_id": 17, "order_id": 18, "status_id": 1, "address_id": 37, "created_at": "2025-10-21T14:01:40.313173+03:00", "total_amount": 41998.00, "payment_method": null, "delivery_method": null}	{"user_id": 17, "order_id": 18, "status_id": 1, "address_id": 37, "created_at": "2025-10-21T14:01:40.313173+03:00", "total_amount": 41998.00, "payment_method": "sbp", "delivery_method": "courier"}
350	2025-10-21 14:01:40.393249+03	INSERT	\N	PAYMENTS	18	\N	{"table": "payments", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 14:01:40.393249+03	\N	{"amount": 41998.00, "status": "paid", "order_id": 18, "created_at": "2025-10-21T14:01:40.393249+03:00", "payment_id": 18, "method_payments": "sbp"}
351	2025-10-21 14:02:09.263765+03	LOGOUT	17	USER	17	User 17	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:02:09.263765+03	{}	{}
352	2025-10-21 14:02:17.872914+03	LOGIN	19	USER	19	Евгений  Непартов	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:02:17.872914+03	\N	\N
353	2025-10-21 14:03:22.544134+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:03:22.544134+03	{}	{}
354	2025-10-21 14:06:50.374713+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:06:50.374713+03	\N	\N
355	2025-10-21 14:08:59.93834+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:08:59.93834+03	{}	{}
356	2025-10-21 14:10:07.97562+03	INSERT	\N	USERS	20	Карина Алексеева	{"table": "users", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 14:10:07.97562+03	\N	{"email": "karina_alekseeva_2006@mail.ru", "user_id": 20, "last_name": "Алексеева", "created_at": "2025-10-21T14:10:07.97562+03:00", "first_name": "Карина"}
357	2025-10-21 14:10:10.027065+03	CREATE_USER	\N	USER	20	Карина Алексеева	{"role": "client", "email": "karina_alekseeva_2006@mail.ru", "method": "self_registration"}	MEDIUM	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:10:10.027065+03	\N	\N
383	2025-10-21 16:31:21.912688+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:31:21.912688+03	{}	{}
358	2025-10-21 14:13:12.785923+03	INSERT	\N	ORDERS	19	\N	{"table": "orders", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 14:13:12.785923+03	\N	{"user_id": 20, "order_id": 19, "status_id": 1, "address_id": 38, "created_at": "2025-10-21T14:13:12.785923+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}
359	2025-10-21 14:13:12.785923+03	INSERT	\N	ORDER_ITEMS	49	\N	{"table": "order_items", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 14:13:12.785923+03	\N	{"price": 199.50, "order_id": 19, "quantity": 224, "product_id": 1, "order_item_id": 49}
360	2025-10-21 14:13:12.785923+03	UPDATE	\N	ORDERS	19	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 14:13:12.785923+03	{"user_id": 20, "order_id": 19, "status_id": 1, "address_id": 38, "created_at": "2025-10-21T14:13:12.785923+03:00", "total_amount": 0.00, "payment_method": null, "delivery_method": null}	{"user_id": 20, "order_id": 19, "status_id": 1, "address_id": 38, "created_at": "2025-10-21T14:13:12.785923+03:00", "total_amount": 44688.00, "payment_method": null, "delivery_method": null}
361	2025-10-21 14:13:12.785923+03	UPDATE	\N	ORDERS	19	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 14:13:12.785923+03	{"user_id": 20, "order_id": 19, "status_id": 1, "address_id": 38, "created_at": "2025-10-21T14:13:12.785923+03:00", "total_amount": 44688.00, "payment_method": null, "delivery_method": null}	{"user_id": 20, "order_id": 19, "status_id": 1, "address_id": 38, "created_at": "2025-10-21T14:13:12.785923+03:00", "total_amount": 44688.00, "payment_method": "card", "delivery_method": "courier"}
362	2025-10-21 14:13:12.805211+03	INSERT	\N	PAYMENTS	19	\N	{"table": "payments", "tg_op": "INSERT"}	LOW	\N	\N	2025-10-21 14:13:12.805211+03	\N	{"amount": 44688.00, "status": "paid", "order_id": 19, "created_at": "2025-10-21T14:13:12.805211+03:00", "payment_id": 19, "method_payments": "card"}
363	2025-10-21 14:13:27.344135+03	DELETE	\N	USERS	20	Карина Алексеева	{"table": "users", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-21 14:13:27.344135+03	{"email": "karina_alekseeva_2006@mail.ru", "user_id": 20, "last_name": "Алексеева", "created_at": "2025-10-21T14:10:07.97562+03:00", "first_name": "Карина"}	\N
364	2025-10-21 14:13:27.344135+03	UPDATE	\N	ORDERS	19	\N	{"table": "orders", "tg_op": "UPDATE"}	LOW	\N	\N	2025-10-21 14:13:27.344135+03	{"user_id": 20, "order_id": 19, "status_id": 1, "address_id": 38, "created_at": "2025-10-21T14:13:12.785923+03:00", "total_amount": 44688.00, "payment_method": "card", "delivery_method": "courier"}	{"user_id": null, "order_id": 19, "status_id": 1, "address_id": 38, "created_at": "2025-10-21T14:13:12.785923+03:00", "total_amount": 44688.00, "payment_method": "card", "delivery_method": "courier"}
365	2025-10-21 14:13:27.354501+03	DELETE_USER	1	USER	20	undefined undefined	{"deletedBy": "admin"}	HIGH	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:13:27.354501+03	\N	\N
366	2025-10-21 14:13:31.316912+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:13:31.316912+03	\N	\N
367	2025-10-21 14:25:54.430471+03	DELETE	\N	ORDERS	19	\N	{"table": "orders", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-21 14:25:54.430471+03	{"user_id": null, "order_id": 19, "status_id": 1, "address_id": 38, "created_at": "2025-10-21T14:13:12.785923+03:00", "total_amount": 44688.00, "payment_method": "card", "delivery_method": "courier"}	\N
368	2025-10-21 14:25:54.430471+03	DELETE	\N	PAYMENTS	19	\N	{"table": "payments", "tg_op": "DELETE"}	LOW	\N	\N	2025-10-21 14:25:54.430471+03	{"amount": 44688.00, "status": "paid", "order_id": 19, "created_at": "2025-10-21T14:13:12.805211+03:00", "payment_id": 19, "method_payments": "card"}	\N
369	2025-10-21 14:34:05.51131+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:34:05.51131+03	{}	{}
370	2025-10-21 14:34:10.170366+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:34:10.170366+03	\N	\N
371	2025-10-21 14:35:45.694427+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:35:45.694427+03	{}	{}
372	2025-10-21 14:35:49.429073+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 14:35:49.429073+03	\N	\N
373	2025-10-21 15:32:06.448674+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 15:32:06.448674+03	{}	{}
374	2025-10-21 15:49:52.248333+03	LOGIN	19	USER	19	Евгений  Непартов	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 15:49:52.248333+03	\N	\N
375	2025-10-21 15:49:58.605362+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 15:49:58.605362+03	{}	{}
376	2025-10-21 15:50:06.437673+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 15:50:06.437673+03	\N	\N
377	2025-10-21 16:00:48.698198+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:00:48.698198+03	{}	{}
378	2025-10-21 16:01:02.307578+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:01:02.307578+03	\N	\N
379	2025-10-21 16:10:50.850942+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:10:50.850942+03	{}	{}
380	2025-10-21 16:10:55.2202+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:10:55.2202+03	\N	\N
381	2025-10-21 16:11:04.903407+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:11:04.903407+03	{}	{}
382	2025-10-21 16:11:29.648213+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:11:29.648213+03	\N	\N
384	2025-10-21 16:33:46.298624+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:33:46.298624+03	\N	\N
385	2025-10-21 16:37:09.811336+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:37:09.811336+03	{}	{}
386	2025-10-21 16:37:23.595754+03	LOGIN	19	USER	19	Евгений  Непартов	{"email": "neparta@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:37:23.595754+03	\N	\N
387	2025-10-21 16:38:13.391836+03	LOGOUT	19	USER	19	User 19	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:38:13.391836+03	{}	{}
388	2025-10-21 16:38:45.96106+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 16:38:45.96106+03	\N	\N
389	2025-10-21 23:24:49.066589+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 23:24:49.066589+03	{}	{}
390	2025-10-21 23:24:49.073413+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 23:24:49.073413+03	{}	{}
391	2025-10-21 23:24:49.083104+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 23:24:49.083104+03	{}	{}
392	2025-10-21 23:25:14.154189+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 23:25:14.154189+03	\N	\N
393	2025-10-21 23:25:14.170086+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 23:25:14.170086+03	\N	\N
394	2025-10-21 23:25:59.292627+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 23:25:59.292627+03	{}	{}
395	2025-10-21 23:26:12.735986+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-21 23:26:12.735986+03	\N	\N
396	2025-10-22 00:32:43.396237+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-22 00:32:43.396237+03	{}	{}
397	2025-10-22 00:32:46.271529+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-22 00:32:46.271529+03	\N	\N
398	2025-10-22 00:38:44.065094+03	LOGOUT	1	USER	1	User 1	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-22 00:38:44.065094+03	{}	{}
399	2025-10-22 00:38:49.041796+03	LOGIN	18	USER	18	Олег Иоанев	{"email": "kenshi326@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-22 00:38:49.041796+03	\N	\N
400	2025-10-22 00:39:08.54408+03	LOGOUT	18	USER	18	User 18	{}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-22 00:39:08.54408+03	{}	{}
401	2025-10-22 00:39:14.006246+03	LOGIN	1	USER	1	Admin User	{"email": "emilka560@mail.ru"}	LOW	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-22 00:39:14.006246+03	\N	\N
\.


--
-- Data for Name: backups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.backups (backup_id, filename, file_path, file_size_mb, created_by, created_at, description, is_automatic) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (category_id, name_categories, description) FROM stdin;
1	Шоколад	Насыщенный, тающий во рту шоколад из отборного какао с богатыми ароматами.
2	Конфеты	Разнообразные конфеты ручной работы: пралине, трюфели и карамель — идеальны для подарка.
3	Торты	Праздничные торты с индивидуальным дизайном и свежими ингредиентами, создающие событие.
4	Чизкейки	Нежные, сливочные чизкейки на хрустящей основе с яркой текстурой и балансом сладости.
5	Капкейк	Нежные мини-торты с воздушным бисквитом и аппетитным кремом, созданные для сладких моментов радости.
6	Турецкие сладости	Оч вкусные турецкие сладости
7	Молочный шоколад	Молочный шоколад оч вкусный
8	Черный шоколад	Черный шоколад очень питателен
\.


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feedback (feedback_id, user_id, topic, message_feedback, email, created_at, status) FROM stdin;
\.


--
-- Data for Name: manufacturers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturers (manufacturer_id, name_manufacturers, description) FROM stdin;
1	Сладкая Фабрика	Семейная кондитерская, создающая душевные десерты из натуральных ингредиентов: от классики до авторских сладостей.
2	Шоколадная фабрика	Мастерская премиального шоколада: отборное какао, ручная обработка и изысканные вкусовые сочетания.
3	АлабугаПолитех	Крутая фабрика для изготовления сладостей
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (order_item_id, order_id, product_id, quantity, price) FROM stdin;
4	5	1	2	199.50
5	6	4	1	129.50
6	7	5	1	219.00
7	8	4	1	129.50
8	9	4	1	129.50
9	10	4	1	129.50
10	11	4	1	129.50
11	12	4	1	129.50
12	13	6	1	189.00
13	14	1	1	199.50
14	15	5	1	219.00
15	1	4	1	129.50
16	2	5	1	219.00
17	3	3	1	149.00
18	4	4	1	129.50
19	5	5	1	219.00
20	6	1	1	199.50
21	7	4	1	129.50
22	7	2	1	499.00
23	7	3	1	149.00
24	8	6	1	189.00
25	8	5	1	219.00
26	8	4	1	129.50
27	8	3	1	149.00
28	8	2	1	499.00
29	8	1	1	199.50
30	9	6	1	189.00
31	9	5	1	219.00
32	9	4	1	129.50
33	9	3	1	149.00
34	9	2	1	499.00
35	9	1	1	199.50
36	10	5	1	219.00
37	11	8	1	999.00
38	12	5	1	219.00
39	13	3	1	149.00
40	14	6	1	189.00
41	15	1	1	199.50
42	15	5	1	209.99
43	15	3	1	149.00
44	16	4	1	129.50
45	16	11	1	300.00
46	17	5	1	209.99
47	17	1	1	199.50
48	18	5	200	209.99
49	19	1	224	199.50
\.


--
-- Data for Name: order_statuses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_statuses (status_id, code, name_orderstatuses, description) FROM stdin;
1	new	Новый	Новый заказ
2	processing	В обработке	Заказ обрабатывается
3	shipped	Отправлен	Заказ отправлен
4	delivered	Доставлен	Заказ доставлен
5	canceled	Отменён	Заказ отменён
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (order_id, user_id, address_id, status_id, total_amount, delivery_method, payment_method, created_at) FROM stdin;
2	5	20	1	219.00	courier	card	2025-10-17 18:22:40.735216+03
16	18	35	1	429.50	pickup	meet	2025-10-20 21:55:18.889792+03
3	5	22	1	149.00	pickup	card	2025-10-17 18:31:46.691172+03
5	5	24	1	618.00	post	card	2025-10-17 18:45:27.495257+03
17	18	36	4	409.49	pickup	meet	2025-10-21 11:40:34.770335+03
18	17	37	1	41998.00	courier	sbp	2025-10-21 14:01:40.313173+03
12	5	31	2	348.50	courier	sbp	2025-10-20 12:48:03.671296+03
14	18	33	3	388.50	courier	sbp	2025-10-20 14:46:17.696869+03
13	18	32	5	338.00	pickup	meet	2025-10-20 14:44:08.098773+03
8	5	27	2	1514.50	pickup	meet	2025-10-17 23:57:44.128221+03
9	5	28	3	1514.50	pickup	card	2025-10-19 01:25:29.85737+03
10	13	29	4	348.50	courier	card	2025-10-19 17:39:56.647569+03
6	5	25	2	329.00	pickup	card	2025-10-17 18:52:47.027647+03
7	5	26	5	996.50	pickup	card	2025-10-17 19:54:27.56343+03
4	5	23	2	129.50	pickup	card	2025-10-17 18:39:22.484067+03
1	5	17	2	129.50	post	card	2025-10-17 17:55:16.253412+03
15	18	34	1	777.49	pickup	meet	2025-10-20 20:34:24.609762+03
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (payment_id, order_id, amount, method_payments, status, created_at) FROM stdin;
1	1	129.50	card	pending	2025-10-17 17:55:16.270828+03
2	2	219.00	card	pending	2025-10-17 18:22:40.750811+03
3	3	149.00	card	pending	2025-10-17 18:31:46.711512+03
4	4	129.50	card	pending	2025-10-17 18:39:22.505377+03
5	5	618.00	card	pending	2025-10-17 18:45:27.51671+03
6	6	329.00	card	pending	2025-10-17 18:52:47.045373+03
7	7	996.50	card	pending	2025-10-17 19:54:27.583847+03
8	8	1514.50	cod	pending	2025-10-17 23:57:44.166225+03
9	9	1514.50	card	pending	2025-10-19 01:25:29.88949+03
10	10	348.50	card	pending	2025-10-19 17:39:56.689746+03
12	12	348.50	sbp	paid	2025-10-20 12:48:03.695835+03
13	13	338.00	cod	pending	2025-10-20 14:44:08.117417+03
14	14	388.50	sbp	paid	2025-10-20 14:46:17.717223+03
15	15	777.49	cod	pending	2025-10-20 20:34:24.639051+03
16	16	429.50	cod	pending	2025-10-20 21:55:18.906663+03
17	17	409.49	cod	pending	2025-10-21 11:40:34.794685+03
18	18	41998.00	sbp	paid	2025-10-21 14:01:40.393249+03
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (product_id, name_product, description, price, weight_grams, photo_url, category_id, manufacturer_id, sku, created_at) FROM stdin;
1	Капкейки с черникой	Этот капкейк — настоящее произведение искусства! Нежный ванильный бисквит, пропитанный черничным сиропом, словно создан для того, чтобы покорить сердца любителей сладкого. Внутри скрывается сочная начинка из черничного пюре и сливочного крема, которая делает каждый кусочек незабываемым.	199.50	100	C:\\Users\\Lenovo\\shop\\first-site\\public\\images\\sweet4.jpg	5	2	DC100	2025-10-07 16:41:15.585625+03
2	Черничный чизкейк	Черничный чизкейк — это нежный десерт, который сочетает в себе сливочный вкус крем-сыра и освежающую кислинку черники. Он состоит из рассыпчатой основы из печенья, кремовой начинки и ягодного слоя, украшенного свежими ягодами.	499.00	250	C:\\Users\\Lenovo\\shop\\first-site\\public\\images\\sweet5.jpg	4	1	MC250	2025-10-07 16:41:15.585625+03
3	Неаполитанские капкейки	Неаполитанские капкейки — это десерт, вдохновленный классическим итальянским мороженым «Неаполитан», которое сочетает три вкуса: шоколад, ваниль и клубника. Эти капкейки отличаются многослойной структурой, где каждый слой представляет один из этих вкусов.	149.00	200	C:\\Users\\Lenovo\\shop\\first-site\\public\\images\\sweet6.jpg	5	1	SC200	2025-10-07 16:41:15.585625+03
4	Черный лес	Шварцвальдский вишневый торт, или «Черный лес», — это знаменитый немецкий десерт, который сочетает в себе насыщенный шоколадный вкус, нежность сливок и кислинку вишни. Его название связано с регионом Шварцвальд (Черный лес) в Германии, где, по легенде, этот торт был впервые приготовлен.	129.50	150	C:\\Users\\Lenovo\\shop\\first-site\\public\\images\\sweet7.jpg	3	2	CT150	2025-10-07 16:41:15.585625+03
6	Торт «Красный бархат»	Торт «Красный бархат» — это классический американский десерт, который отличается насыщенным красным цветом, нежным вкусом и бархатистой текстурой. Его история уходит корнями в XIX век, когда он был известен под разными названиями, такими как «Красный Уолдорфский торт» или «Красный ковровый торт».	189.00	280	C:\\Users\\Lenovo\\shop\\first-site\\public\\images\\sweet9.jpg	3	2	OC280	2025-10-07 16:41:15.585625+03
5	Чизкейк «Red Velvet Oreo»	Этот изысканный десерт сочетает в себе нежность чизкейка, насыщенный вкус красного бархата и хрустящую текстуру печенья Oreo. Основа из измельченных Oreo создает контраст с кремовым слоем, а яркий красный цвет и вишневый соус делают его настоящим украшением стола. Украшение из взбитых сливок, печенья и вишен завершает этот кулинарный шедевр, превращая его в идеальный выбор для особых случаев.	209.99	300	/images/sweet8.jpg	4	1	BC300	2025-10-07 16:41:15.585625+03
12	Сладости с орехами	Крутые сладости с орехами прямиком из Турции.	100.00	900	/images/product1761035650983.jpg	6	3	TUR234KIS	2025-10-21 11:17:28.497997+03
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reviews (review_id, product_id, user_id, rating, comment_reviews, created_at, is_visible) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (role_id, name_role) FROM stdin;
1	admin
2	manager
3	client
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (user_id, role_id) FROM stdin;
1	1
5	3
13	3
17	3
19	2
18	3
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, first_name, last_name, email, password_hash, created_at) FROM stdin;
17	Карина	Угабуга	alexander674sanek@mail.ru	$2b$10$tulxsynpfxzqRoaouCSJ1u1Or2eKKFKbJbeaWhDeUdrs0J60vNLlm	2025-10-20 12:00:44.912124+03
1	Admin	User	emilka560@mail.ru	admin12345	2025-10-17 16:51:27.318115+03
13	Никита	Панфилов	nikita560@mail.ru	$2b$10$KIy..sDTeAcj3iO0EIgwKeavx175SSdQa4NI2bLneqPDa1lQqZ3hK	2025-10-19 17:38:56.58522+03
5	Владимир	Егоров	hodzahove@gmail.com	hodzahove12345	2025-10-17 17:18:32.314296+03
18	Олег	Иоанев	kenshi326@mail.ru	123321Sae	2025-10-20 13:10:50.971049+03
19	Евгений 	Непартов	neparta@mail.ru	$2b$10$5jPjrukuq3UNv77TNm1mR.iXBi0uh/2E/7NzuoRDTr0L/XeHSwdq.	2025-10-20 14:57:55.848183+03
\.


--
-- Name: addresses_address_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.addresses_address_id_seq', 38, true);


--
-- Name: audit_logs_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_audit_id_seq', 401, true);


--
-- Name: backups_backup_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.backups_backup_id_seq', 1, true);


--
-- Name: categories_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_category_id_seq', 8, true);


--
-- Name: feedback_feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.feedback_feedback_id_seq', 1, false);


--
-- Name: manufacturers_manufacturer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.manufacturers_manufacturer_id_seq', 3, true);


--
-- Name: order_items_order_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_order_item_id_seq', 49, true);


--
-- Name: order_statuses_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_statuses_status_id_seq', 4, true);


--
-- Name: orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_order_id_seq', 19, true);


--
-- Name: payments_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payments_payment_id_seq', 19, true);


--
-- Name: products_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_product_id_seq', 13, true);


--
-- Name: reviews_review_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reviews_review_id_seq', 1, false);


--
-- Name: roles_role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_role_id_seq', 1, false);


--
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 20, true);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (address_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (audit_id);


--
-- Name: backups backups_filename_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backups
    ADD CONSTRAINT backups_filename_key UNIQUE (filename);


--
-- Name: backups backups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backups
    ADD CONSTRAINT backups_pkey PRIMARY KEY (backup_id);


--
-- Name: categories categories_name_categories_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_categories_key UNIQUE (name_categories);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (category_id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (feedback_id);


--
-- Name: manufacturers manufacturers_name_manufacturers_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_name_manufacturers_key UNIQUE (name_manufacturers);


--
-- Name: manufacturers manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_pkey PRIMARY KEY (manufacturer_id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (order_item_id);


--
-- Name: order_statuses order_statuses_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_statuses
    ADD CONSTRAINT order_statuses_code_key UNIQUE (code);


--
-- Name: order_statuses order_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_statuses
    ADD CONSTRAINT order_statuses_pkey PRIMARY KEY (status_id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- Name: payments payments_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_key UNIQUE (order_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (review_id);


--
-- Name: roles roles_name_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_role_key UNIQUE (name_role);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_severity ON public.audit_logs USING btree (severity);


--
-- Name: idx_audit_logs_target_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_target_type ON public.audit_logs USING btree (target_type);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_product ON public.order_items USING btree (product_id);


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_product ON public.reviews USING btree (product_id);


--
-- Name: idx_reviews_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_user ON public.reviews USING btree (user_id);


--
-- Name: categories trg_audit_categories_all; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_categories_all AFTER INSERT OR DELETE OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();


--
-- Name: manufacturers trg_audit_manufacturers_all; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_manufacturers_all AFTER INSERT OR DELETE OR UPDATE ON public.manufacturers FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();


--
-- Name: order_items trg_audit_order_items_all; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_order_items_all AFTER INSERT OR DELETE OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();


--
-- Name: orders trg_audit_orders_all; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_orders_all AFTER INSERT OR DELETE OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();


--
-- Name: payments trg_audit_payments_all; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_payments_all AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();


--
-- Name: products trg_audit_products_all; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_products_all AFTER INSERT OR DELETE OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();


--
-- Name: reviews trg_audit_reviews_all; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_reviews_all AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();


--
-- Name: users trg_audit_users_all; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_audit_users_all AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row_change();


--
-- Name: order_items trg_recalculate_order_total_after_ins_upd_del; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_recalculate_order_total_after_ins_upd_del AFTER INSERT OR DELETE OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.fn_recalculate_order_total();


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: backups backups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backups
    ADD CONSTRAINT backups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: orders orders_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(address_id) ON DELETE SET NULL;


--
-- Name: orders orders_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.order_statuses(status_id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id) ON DELETE SET NULL;


--
-- Name: products products_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(manufacturer_id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id) ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

