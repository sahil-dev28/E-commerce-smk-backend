require("dotenv").config();
require("express-async-errors");

const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const rateLimiter = require("express-rate-limit");
const helmet = require("helmet");
const xss = require("xss-clean");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const whitelist = [process.env.FRONT_END_ORIGIN, process.env.ADMIN_ORIGIN];

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");

const authRouter = require("./routes/authRoutes");
const userRouter = require("./routes/userRoutes");
const returnReasonRouter = require("./routes/returnResultRoutes");
const categoryRouter = require("./routes/categoryRoutes");
const sizeRouter = require("./routes/sizeRoutes");
const couponRouter = require("./routes/couponRoutes");
const productRouter = require("./routes/productRoutes");
const reviewRouter = require("./routes/reviewRoutes");
const addressRouter = require("./routes/addressRoute");
const orderRouter = require("./routes/orderRoute");

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(xss());
app.use(express.json());
app.use(morgan("tiny"));
app.use(cookieParser(process.env.JWT_SECRET));
app.use(
  fileUpload({
    useTempFiles: true,
  })
);
const corsOptionsDelegate = function (req, callback) {
  let corsOptions;
  if (whitelist.indexOf(req.header("Origin")) !== -1) {
    corsOptions = {
      origin: [process.env.FRONT_END_ORIGIN, process.env.ADMIN_ORIGIN],
      optionsSuccessStatus: 200,
      credentials: true,
    };
  } else {
    corsOptions = { origin: false };
  }
  callback(null, corsOptions);
};
app.use(cors(corsOptionsDelegate));
// app.use(
//   rateLimiter({
//     windowMs: 15 * 60 * 1000,
//     max: 60,
//   })
// );

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/return-reason", returnReasonRouter);
app.use("/api/v1/category", categoryRouter);
app.use("/api/v1/size", sizeRouter);
app.use("/api/v1/coupon", couponRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/review", reviewRouter);
app.use("/api/v1/address", addressRouter);
app.use("/api/v1/order", orderRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5000;

const start = () => {
  app.listen(port, () => {
    console.log(`Server is listening on port ${port}...`);
  });
};

start();
