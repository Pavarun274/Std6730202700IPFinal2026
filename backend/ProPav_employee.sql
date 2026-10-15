-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 15, 2026 at 03:43 AM
-- Server version: 8.0.46-0ubuntu0.24.04.4
-- PHP Version: 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ip_std6730202700`
--

-- --------------------------------------------------------

--
-- Table structure for table `ProPav_employee`
--

CREATE TABLE `ProPav_employee` (
  `id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('Active','On Leave') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active',
  `salary` decimal(12,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ;

--
-- Dumping data for table `ProPav_employee`
--

INSERT INTO `ProPav_employee` (`id`, `name`, `position`, `status`, `salary`, `created_at`, `updated_at`) VALUES
(1, 'John Doe', 'Software Engineer', 'Active', 45000.00, '2026-10-15 03:14:17', '2026-10-15 03:14:17'),
(2, 'Jane Smith', 'Junior Developer', 'Active', 18500.00, '2026-10-15 03:14:17', '2026-10-15 03:14:17'),
(3, 'Somchai Jaidee', 'Technical Lead', 'On Leave', 85000.00, '2026-10-15 03:14:17', '2026-10-15 03:14:17'),
(4, 'Mali Rakdee', 'QA Tester', 'Active', 19000.00, '2026-10-15 03:14:17', '2026-10-15 03:14:17'),
(5, 'David Chen', 'Product Manager', 'Active', 72000.00, '2026-10-15 03:14:17', '2026-10-15 03:14:17'),
(6, 'Anna Lee', 'Designer', 'On Leave', 38000.00, '2026-10-15 03:14:17', '2026-10-15 03:14:17'),
(7, 'Peter Parker', 'Intern', 'Active', 15000.00, '2026-10-15 03:14:17', '2026-10-15 03:14:17'),
(8, 'Nok Sriwong', 'Senior Engineer', 'Active', 58000.00, '2026-10-15 03:14:17', '2026-10-15 03:35:56');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ProPav_employee`
--
ALTER TABLE `ProPav_employee`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ProPav_employee`
--
ALTER TABLE `ProPav_employee`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
