const { StatusCodes } = require("http-status-codes");
const cloudinary = require("cloudinary").v2;
const fs = require("fs").promises;

const prisma = require("../../prisma/prisma-client");

const CustomError = require("../errors");
const customUtils = require("../utils");
const retrieveSchema = require("../retrieveSchema");
const modelMethods = require("../model-methods");

const createProduct = async (req, res) => {
  if (!req.files || !req.files.image) {
    throw new CustomError.BadRequestError("Please provide product image");
  }
  const { image } = req.files;

  try {
    if (!image.mimetype.startsWith("image")) {
      throw new CustomError.BadRequestError("Please upload an image");
    }

    const maxSize = 1024 * 1024;

    if (image.size >= maxSize) {
      throw new CustomError.BadRequestError(
        "Please upload an image smaller than 1 MB",
      );
    }

    const existingProduct = await prisma.product.findUnique({
      where: {
        name: req.body.name,
      },
    });

    if (existingProduct) {
      throw new CustomError.ConflictError(
        `Product ${req.body.name} already exists`,
      );
    }

    const result = await cloudinary.uploader.upload(image.tempFilePath, {
      use_filename: true,
      folder: "e_commerce_app/product-images",
    });

    await fs.unlink(image.tempFilePath);

    const { constructedProduct, constructedSize } = new modelMethods.Product(
      req.body,
    ).constructProduct();

    await prisma.product.create({
      data: {
        ...constructedProduct,
        image: result.secure_url,
        imageId: result.public_id,
        sizes: {
          connect: constructedSize.map((size) => ({ id: size })),
        },
      },
    });

    res.status(StatusCodes.CREATED).json({});
  } catch (error) {
    await fs.unlink(image.tempFilePath);
    throw error;
  }
};

const getAllProducts = async (req, res) => {
  const { search, featured, sort, categoryId, sizeId, priceSort } = req.query;

  let queryObject = {
    where: {},
    orderBy: [],
  };

  if (search) {
    queryObject.where = {
      ...queryObject.where,
      name: {
        startsWith: search,
        mode: "insensitive",
      },
    };
  }

  if (categoryId) {
    queryObject.where = {
      ...queryObject.where,
      categoryId,
    };
  }

  if (sizeId) {
    queryObject.where = {
      ...queryObject.where,
      sizes: {
        some: {
          id: sizeId,
        },
      },
    };
  }

  if (featured == 1) {
    queryObject.where = {
      ...queryObject.where,
      featured: true,
    };
  }

  if (priceSort === "highest") {
    queryObject.orderBy.push({
      price: "desc",
    });
  }

  if (priceSort === "lowest") {
    queryObject.orderBy.push({
      price: "asc",
    });
  }

  if (sort == "highest-rated") {
    queryObject.orderBy.push({
      averageRating: "desc",
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

  if (sort === "a-z") {
    queryObject.orderBy.push({
      name: "asc",
    });
  }

  if (sort === "z-a") {
    queryObject.orderBy.push({
      name: "desc",
    });
  }

  if (!sort) {
    queryObject.orderBy.push({
      createdAt: "desc",
    });
  }

  const page = +req.query.page || 1;
  const take = 8;
  const skip = (page - 1) * take;

  let products = await prisma.product.findMany({
    skip,
    take,
    ...queryObject,
    select: retrieveSchema.products,
  });

  products = products.map((product) => {
    let mappedProduct = {
      ...product,
      isWishListed: false,
      isAddedToCart: false,
    };
    product.wishListedBy.forEach((user) => {
      if (user.id === req.user?.userId) {
        mappedProduct.isWishListed = true;
      }
    });
    product.cartBy.forEach((user) => {
      if (user.id === req.user?.userId) {
        mappedProduct.isAddedToCart = true;
      }
    });
    delete mappedProduct.wishListedBy;
    delete mappedProduct.cartBy;
    return mappedProduct;
  });

  const totalProducts = await prisma.product.count({
    ...queryObject,
  });
  const numOfPages = Math.ceil(totalProducts / take);

  res.status(StatusCodes.OK).json({ products, totalProducts, numOfPages });
};

const getWishListedProducts = async (req, res) => {
  const page = +req.query.page || 1;
  const take = 8;
  const skip = (page - 1) * take;

  console.log("userId", req.user.userId);

  let products = await prisma.product.findMany({
    skip,
    take,
    where: {
      wishListedBy: {
        some: {
          id: req.user.userId,
        },
      },
    },
    select: retrieveSchema.products,
  });

  products = products.map((product) => {
    let mappedProduct = {
      ...product,
      isWishListed: true,
      isAddedToCart: false,
    };

    product.cartBy.forEach((user) => {
      if (user.id === req.user?.userId) {
        mappedProduct.isAddedToCart = true;
      }
    });
    delete mappedProduct.wishListedBy;
    delete mappedProduct.cartBy;
    return mappedProduct;
  });

  const totalProducts = await prisma.product.count({
    where: {
      wishListedBy: {
        some: {
          id: req.user.userId,
        },
      },
    },
  });
  const numOfPages = Math.ceil(totalProducts / take);

  res.status(StatusCodes.OK).json({ products, totalProducts, numOfPages });
};

const updateProduct = async (req, res) => {
  const {
    params: { id: productId },
    body,
  } = req;

  const image = req?.files?.image;

  try {
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      throw new CustomError.NotFoundError(
        `No product found with id of ${productId}`,
      );
    }

    const { constructedProduct, constructedSize } = new modelMethods.Product(
      body,
    ).constructProduct();

    if (image) {
      if (!image.mimetype.startsWith("image")) {
        throw new CustomError.BadRequestError("Please upload an image");
      }

      const maxSize = 1024 * 1024;

      if (image.size >= maxSize) {
        throw new CustomError.BadRequestError(
          "Please upload an image smaller than 1 MB",
        );
      }

      const result = await cloudinary.uploader.upload(image.tempFilePath, {
        use_filename: true,
        folder: "e_commerce_app/product-images",
      });

      await fs.unlink(image.tempFilePath);

      constructedProduct.image = result.secure_url;
      constructedProduct.imageId = result.public_id;
    }

    let nestedUpdateQuery = {};

    if (constructedSize?.length) {
      nestedUpdateQuery.sizes = {
        set: [],
        connect: constructedSize.map((size) => ({ id: size })),
      };
    }

    await prisma.product.update({
      data: {
        ...constructedProduct,
        ...nestedUpdateQuery,
      },
      where: {
        id: productId,
      },
    });

    if (image && product.imageId) {
      await cloudinary.uploader.destroy(product.imageId);
    }

    res.status(StatusCodes.OK).json({});
  } catch (error) {
    if (image) {
      await fs.unlink(image.tempFilePath);
    }
    throw error;
  }
};

const getSingleProduct = async (req, res) => {
  const { id: productId } = req.params;

  let product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: retrieveSchema.product,
  });

  if (!product) {
    throw new CustomError.NotFoundError(
      `No product found with id of ${productId}`,
    );
  }

  product = { ...product, isWishListed: false, isAddedToCart: false };
  product.wishListedBy.forEach((user) => {
    if (user.id === req.user?.userId) {
      product.isWishListed = true;
    }
  });
  product.cartBy.forEach((user) => {
    if (user.id === req.user?.userId) {
      product.isAddedToCart = true;
    }
  });
  delete product.wishListedBy;
  delete product.cartBy;

  res.status(StatusCodes.OK).json({ product });
};

const deleteProduct = async (req, res) => {
  const { id: productId } = req.params;

  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
  });

  if (!product) {
    throw new CustomError.NotFoundError(
      `No product found with id of ${productId}`,
    );
  }

  await prisma.product.delete({
    where: {
      id: productId,
    },
  });

  if (product.imageId) {
    await cloudinary.uploader.destroy(product.imageId);
  }

  res.status(StatusCodes.OK).json({});
};

const addProductToWishList = async (req, res) => {
  const {
    user: { userId },
    params: { id: productId },
  } = req;

  await prisma.product.update({
    data: {
      wishListedBy: {
        connect: { id: userId },
      },
    },
    where: {
      id: productId,
    },
  });

  res.status(StatusCodes.OK).json({});
};

const removeProductFromWishList = async (req, res) => {
  const {
    user: { userId },
    params: { id: productId },
  } = req;

  await prisma.product.update({
    data: {
      wishListedBy: {
        disconnect: { id: userId },
      },
    },
    where: {
      id: productId,
    },
  });

  res.status(StatusCodes.OK).json({});
};

const addProductToCart = async (req, res) => {
  const {
    user: { userId },
    params: { id: productId },
  } = req;

  await prisma.product.update({
    data: {
      cartBy: {
        connect: { id: userId },
      },
    },
    where: {
      id: productId,
    },
  });

  res.status(StatusCodes.OK).json({});
};

const removeProductFromCart = async (req, res) => {
  const {
    user: { userId },
    params: { id: productId },
  } = req;

  await prisma.product.update({
    data: {
      cartBy: {
        disconnect: { id: userId },
      },
    },
    where: {
      id: productId,
    },
  });

  res.status(StatusCodes.OK).json({});
};

const getCart = async (req, res) => {
  const page = +req.query.page || 1;
  const take = 8;
  const skip = (page - 1) * take;

  console.log("userId", req.user.userId);

  let products = await prisma.product.findMany({
    skip,
    take,
    where: {
      cartBy: {
        some: {
          id: req.user.userId,
        },
      },
    },
    select: retrieveSchema.products,
  });

  products = products.map((product) => {
    let mappedProduct = {
      ...product,
      isWishListed: false,
      isAddedToCart: true,
    };
    product.wishListedBy.forEach((user) => {
      if (user.id === req.user?.userId) {
        mappedProduct.isWishListed = true;
      }
    });
    delete mappedProduct.wishListedBy;
    delete mappedProduct.cartBy;
    return mappedProduct;
  });

  const totalProducts = await prisma.product.count({
    where: {
      cartBy: {
        some: {
          id: req.user.userId,
        },
      },
    },
  });
  const numOfPages = Math.ceil(totalProducts / take);

  res.status(StatusCodes.OK).json({ products, totalProducts, numOfPages });
};

module.exports = {
  createProduct,
  getAllProducts,
  getWishListedProducts,
  updateProduct,
  getSingleProduct,
  deleteProduct,
  addProductToWishList,
  removeProductFromWishList,
  addProductToCart,
  removeProductFromCart,
  getCart,
};
