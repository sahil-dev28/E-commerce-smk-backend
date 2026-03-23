const { StatusCodes } = require("http-status-codes");

const prisma = require("../../prisma/prisma-client");

const CustomError = require("../errors");
const retrieveSchema = require("../retrieveSchema");
const modelMethods = require("../model-methods");

const createCoupon = async (req, res) => {
  await prisma.coupon.create({
    data: req.body,
  });

  res.status(StatusCodes.CREATED).json({});
};

const getAllCoupons = async (req, res) => {
  const { type, search, status, sort, redemptionSort, all } = req.query;

  let queryObject = {
    where: {},
    orderBy: [],
  };

  if (search) {
    queryObject.where = {
      ...queryObject.where,
      code: {
        startsWith: search,
        mode: "insensitive",
      },
    };
  }

  if (type) {
    queryObject.where = {
      ...queryObject.where,
      type: type.toUpperCase(),
    };
  }

  if (status && +status === 1) {
    queryObject.where = {
      ...queryObject.where,
      valid: true,
      expiryTime: {
        gte: new Date(),
      },
    };
  }

  if (status && +status === 0) {
    queryObject.where = {
      ...queryObject.where,
      OR: [
        { valid: false },
        {
          expiryTime: {
            lt: new Date(),
          },
        },
      ],
    };
  }

  if (redemptionSort === "highest") {
    queryObject.orderBy.push({
      totalRedemptions: "desc",
    });
  }

  if (redemptionSort === "lowest") {
    queryObject.orderBy.push({
      totalRedemptions: "asc",
    });
  }

  if (sort == "latest") {
    queryObject.orderBy.push({
      createdAt: "desc",
    });
  }

  if (sort == "oldest") {
    queryObject.orderBy.push({
      createdAt: "asc",
    });
  }

  if (!sort) {
    queryObject.orderBy.push({
      createdAt: "desc",
    });
  }

  const page = +req.query.page || 1;
  const take = 10;
  const skip = (page - 1) * take;

  if (all && +all === 1) {
    queryObject.where = {
      ...queryObject.where,
      totalRedemptions: { lt: prisma.coupon.fields.maxRedemptions },
    };
    const coupons = await prisma.coupon.findMany({
      ...queryObject,
      select: retrieveSchema.coupon,
    });

    res.status(StatusCodes.OK).json({ coupons });
    return;
  }

  const coupons = await prisma.coupon.findMany({
    skip,
    take,
    ...queryObject,
    select: retrieveSchema.coupon,
  });

  const totalCoupons = await prisma.coupon.count({
    ...queryObject,
  });
  const numOfPages = Math.ceil(totalCoupons / take);

  res.status(StatusCodes.OK).json({ coupons, totalCoupons, numOfPages });
};

const updateCoupon = async (req, res) => {
  const {
    params: { id: couponId },
    body,
  } = req;

  const coupon = await prisma.coupon.findUnique({
    where: {
      id: couponId,
    },
  });

  if (!coupon) {
    throw new CustomError.NotFoundError(
      `No coupon found with id of ${couponId}`,
    );
  }

  const couponModel = new modelMethods.Coupon(coupon);
  couponModel.checkCouponExpired();
  couponModel.canUpdateMaxRedemption(body.maxRedemptions);

  await prisma.coupon.update({
    data: body,
    where: {
      id: couponId,
    },
  });

  res.status(StatusCodes.OK).json({});
};

const deleteCoupon = async (req, res) => {
  const { id: couponId } = req.params;

  await prisma.coupon.delete({
    where: {
      id: couponId,
    },
  });

  res.status(StatusCodes.OK).json({});
};

const getAllValidCoupons = async (req, res) => {
  const coupons = await prisma.coupon.findMany({
    where: {
      valid: true,
      expiryTime: {
        gte: new Date(),
      },
      totalRedemptions: { lt: prisma.coupon.fields.maxRedemptions },
    },
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
    select: retrieveSchema.coupon,
  });

  res.status(StatusCodes.OK).json({ coupons });
};

module.exports = {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  deleteCoupon,
  getAllValidCoupons,
};
