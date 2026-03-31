const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Import Routes
const authRoutes = require('./modules/auth/auth.routes');
const guestRoutes = require('./modules/guest/guest.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const cashierRoutes = require('./modules/cashier/cashier.routes');
const sessionRoutes = require('./modules/session/session.routes');
const productRoutes = require('./modules/product/product.routes');
const categoryRoutes = require('./modules/category/category.routes');
// const tableRoutes = require('./modules/table/table.routes');
const orderRoutes = require('./modules/order/order.routes');
const promoRoutes = require('./modules/promo/promo.routes');
const settingRoutes = require('./modules/setting/setting.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cashier', cashierRoutes);
// app.use('/api/menu', menuRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/settings', settingRoutes);

app.get('/', (req, res) => {
  res.send('Backend API is running...');
});

module.exports = app;