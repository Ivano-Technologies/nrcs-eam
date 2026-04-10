import proxy from "./api/proxy.js";

export const config = {
  matcher: "/api/:path*",
};

export default proxy;
