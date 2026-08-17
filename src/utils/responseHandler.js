
  // Status code of 200
  function successResponse(res, message, data = {}, statusCode = 200) {
    return res.status(statusCode).json({
      status: 'success',
      message,
      data,
    });
  }
  
  // Status code of 400
  function errorResponse(res, errorCode, message, statusCode = 400) {
    return res.status(statusCode).json({
      status: 'error',
      error: errorCode,
      message,
    });
  }
  
  module.exports = {
    successResponse,
    errorResponse,
  };
  