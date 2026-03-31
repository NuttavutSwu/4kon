const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const itemRoutes = require('./routes/items');
const categoryRoutes = require('./routes/categories');
const apiRoutes = require('./routes/api');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use('/', itemRoutes);
app.use('/categories', categoryRoutes);
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
