/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["mongoose", "bcryptjs", "nodemailer"],
};

export default nextConfig;
