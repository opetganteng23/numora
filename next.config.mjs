/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["mongoose", "bcryptjs", "nodemailer", "pdfkit", "exceljs"],
};

export default nextConfig;
