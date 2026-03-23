const crypto = require("crypto");
const Razorpay = require("razorpay");

var instance = new Razorpay({
  key_id: process.env.RAZORPAY_ID_KEY,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

const createOrder = (amount) => {
  return new Promise((resolve, reject) => {
    instance.orders.create(
      {
        amount: amount * 100,
        currency: "INR",
      },
      function (error, order) {
        if (error) {
          reject(error);
        }
        console.log({ order });

        resolve(order);
      },
    );
  });
};

const checkSign = ({ paymentId, signature, orderId }) => {
  const data = orderId + "|" + paymentId;

  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
    .update(data.toString())
    .digest("hex");

  return expectedSign === signature;
};

module.exports = { createOrder, checkSign };
