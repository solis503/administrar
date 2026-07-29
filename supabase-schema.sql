-- =====================================================
-- FLOWSTOCK PRO v3 - Script LIMPIO para Supabase
-- =====================================================
-- Ejecútalo UNA SOLA VEZ en el SQL Editor de Supabase
-- =====================================================

-- PASO 1: Borrar todo (CASCADE elimina dependencias automáticamente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_updated_at ON products;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS decrement_stock(UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS decrement_recipe(UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS get_user_role(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_business_ids(UUID) CASCADE;
DROP FUNCTION IF EXISTS create_table_policies(TEXT) CASCADE;

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS recipe_items CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;

-- =====================================================
-- PASO 2: Crear tablas
-- =====================================================

CREATE TABLE businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  currency_symbol TEXT DEFAULT '$',
  tax_percentage DECIMAL(5,2) DEFAULT 13.00,
  loyalty_points_rate DECIMAL(5,2) DEFAULT 10.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('owner','manager','seller')),
  full_name TEXT,
  email TEXT,
  phone TEXT,
  language TEXT DEFAULT 'es',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, business_id)
);

CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_stock DECIMAL(10,2) DEFAULT 5,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  unit TEXT DEFAULT 'piezas',
  product_type TEXT DEFAULT 'simple',
  is_sellable BOOLEAN DEFAULT TRUE,
  barcode TEXT,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipe_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  ingredient_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'piezas',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  category TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pendiente',
  total DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  received BOOLEAN DEFAULT FALSE
);

CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  loyalty_points INTEGER DEFAULT 0,
  credit_balance DECIMAL(10,2) DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  total DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT NOT NULL,
  amount_paid DECIMAL(10,2),
  change_amount DECIMAL(10,2) DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  product_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL
);

CREATE TABLE inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  concept TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT DEFAULT 'Otros',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PASO 3: Activar seguridad RLS
-- =====================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 4: Funciones y políticas
-- =====================================================

CREATE FUNCTION get_user_business_ids(p_user_id UUID)
RETURNS TABLE(bid UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT b.id FROM businesses b WHERE b.owner_id = p_user_id
  UNION
  SELECT pr.business_id FROM profiles pr WHERE pr.user_id = p_user_id AND pr.active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Negocios
CREATE POLICY "biz_all" ON businesses FOR ALL USING (
  auth.uid() = owner_id OR auth.uid() IN (SELECT user_id FROM profiles WHERE business_id = id AND active = TRUE)
);

-- Tablas con business_id (política simple para cada una)
CREATE POLICY "branches_all" ON branches FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));
CREATE POLICY "categories_all" ON categories FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));
CREATE POLICY "products_all" ON products FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));
CREATE POLICY "suppliers_all" ON suppliers FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));
CREATE POLICY "purchase_orders_all" ON purchase_orders FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));
CREATE POLICY "clients_all" ON clients FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));
CREATE POLICY "sales_all" ON sales FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));
CREATE POLICY "inventory_movements_all" ON inventory_movements FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));
CREATE POLICY "expenses_all" ON expenses FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));
CREATE POLICY "notifications_all" ON notifications FOR ALL USING (business_id IN (SELECT get_user_business_ids(auth.uid())));

-- Perfiles
CREATE POLICY "profiles_all" ON profiles FOR ALL USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) OR user_id = auth.uid()
);

-- Recetas
CREATE POLICY "recipe_items_all" ON recipe_items FOR ALL USING (
  product_id IN (SELECT id FROM products WHERE business_id IN (SELECT get_user_business_ids(auth.uid())))
);

-- Items de venta
CREATE POLICY "sale_items_all" ON sale_items FOR ALL USING (
  sale_id IN (SELECT id FROM sales WHERE business_id IN (SELECT get_user_business_ids(auth.uid())))
);

-- Items de orden
CREATE POLICY "po_items_all" ON purchase_order_items FOR ALL USING (
  order_id IN (SELECT id FROM purchase_orders WHERE business_id IN (SELECT get_user_business_ids(auth.uid())))
);

-- =====================================================
-- PASO 5: Funciones automáticas
-- =====================================================

-- Auto-actualizar fecha en productos
CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Al registrarse: crear negocio + sucursal + perfil owner
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE new_biz UUID; new_branch UUID;
BEGIN
  INSERT INTO businesses (owner_id, name) VALUES (NEW.id, 'Mi Negocio') RETURNING id INTO new_biz;
  INSERT INTO branches (business_id, name) VALUES (new_biz, 'Sucursal Principal') RETURNING id INTO new_branch;
  INSERT INTO profiles (user_id, business_id, branch_id, role, full_name, email)
  VALUES (NEW.id, new_biz, new_branch, 'owner', COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Decrementar stock
CREATE FUNCTION decrement_stock(p_product_id UUID, p_quantity DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE products SET stock = GREATEST(0, stock - p_quantity) WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrementar receta recursivamente
CREATE FUNCTION decrement_recipe(p_product_id UUID, p_multiplier DECIMAL)
RETURNS VOID AS $$
DECLARE ing RECORD;
BEGIN
  FOR ing IN SELECT ingredient_id, quantity FROM recipe_items WHERE product_id = p_product_id
  LOOP
    PERFORM decrement_stock(ing.ingredient_id, ing.quantity * p_multiplier);
    IF EXISTS (SELECT 1 FROM products WHERE id = ing.ingredient_id AND product_type = 'receta') THEN
      PERFORM decrement_recipe(ing.ingredient_id, ing.quantity * p_multiplier);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ✅ LISTO! Debe decir "Success. No rows returned"
-- =====================================================
