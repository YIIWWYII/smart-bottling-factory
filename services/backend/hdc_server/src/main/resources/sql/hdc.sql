/*
 Navicat Premium Data Transfer

 Source Server         : 本地mysql
 Source Server Type    : MySQL
 Source Server Version : 90100 (9.1.0)
 Source Host           : localhost:3306
 Source Schema         : hdc

 Target Server Type    : MySQL
 Target Server Version : 90100 (9.1.0)
 File Encoding         : 65001

 Date: 03/07/2025 18:43:46
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for city
-- ----------------------------
DROP TABLE IF EXISTS `city`;
CREATE TABLE `city` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '地区名称',
  `use_flag` int DEFAULT NULL COMMENT '可用标识。0：不可用：1：可用',
  `orders` int DEFAULT NULL COMMENT '排序序号',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='城市字典表';

-- ----------------------------
-- Table structure for device
-- ----------------------------
DROP TABLE IF EXISTS `device`;
CREATE TABLE `device` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `sn` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '设备唯一标识',
  `type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '设备类型。pad、pda、adapter',
  `state` int DEFAULT NULL COMMENT '状态。0离线；1在线',
  `last_online_time` datetime DEFAULT NULL COMMENT '最后一次上报上线的时间',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `delete_flag` int DEFAULT '0' COMMENT '删除标识。0:未删除，默认值；1:已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `index_sn` (`sn`) USING BTREE COMMENT '设备唯一编码索引'
) ENGINE=InnoDB AUTO_INCREMENT=1299 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='设备';

-- ----------------------------
-- Table structure for group
-- ----------------------------
DROP TABLE IF EXISTS `group`;
CREATE TABLE `group` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '组名',
  `code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '进组口令',
  `use_flag` int DEFAULT NULL COMMENT '0：不可用；1可用',
  `city_id` bigint DEFAULT NULL COMMENT '城市id',
  `city_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '城市名称',
  `begin_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `delete_flag` int DEFAULT '0' COMMENT '删除标识。0:未删除，默认值；1:已删除',
  `num_visitor` int DEFAULT '0',
  `num_employee` int DEFAULT '0',
  `simulation` int DEFAULT '0',
  `machine_base_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='分组';

-- ----------------------------
-- Table structure for group_device
-- ----------------------------
DROP TABLE IF EXISTS `group_device`;
CREATE TABLE `group_device` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group_id` bigint DEFAULT NULL COMMENT '分组id',
  `device_sn` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '设备唯一编码',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `delete_flag` int DEFAULT '0' COMMENT '删除标识。0:未删除，默认值；1:已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `index_group_device` (`group_id`,`device_sn`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=609 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='分组-设备';

-- ----------------------------
-- Table structure for group_visitor
-- ----------------------------
DROP TABLE IF EXISTS `group_visitor`;
CREATE TABLE `group_visitor` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '访客类型：visitor或employee',
  `count` int DEFAULT '0' COMMENT '访客人数',
  `group_id` bigint DEFAULT NULL COMMENT '分组id',
  `device_sn` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '设备sn',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=988 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='访客';

-- ----------------------------
-- Table structure for machine_failure
-- ----------------------------
DROP TABLE IF EXISTS `machine_failure`;
CREATE TABLE `machine_failure` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group_id` bigint DEFAULT NULL COMMENT '分组id',
  `machine_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '设备型号',
  `machine_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '设备名称',
  `failure_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '故障原因',
  `failure_level` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '故障级别',
  `failure_time` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '故障时间',
  `failure_recover_time` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '故障恢复时间',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='设备故障表';

-- ----------------------------
-- Table structure for product
-- ----------------------------
DROP TABLE IF EXISTS `product`;
CREATE TABLE `product` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `bar_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '条形码编号',
  `type_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '产品类型码',
  `model_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '产品型号码',
  `path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '图片路径',
  `device_sn` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `group_id` bigint DEFAULT NULL,
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `delete_flag` int DEFAULT '0' COMMENT '删除标识。0:未删除，默认值；1:已删除',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=219 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='产品';

-- ----------------------------
-- Table structure for product_model
-- ----------------------------
DROP TABLE IF EXISTS `product_model`;
CREATE TABLE `product_model` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `type_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `delete_flag` int DEFAULT '0' COMMENT '0:1:',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `index_code` (`code`) USING BTREE COMMENT 'code'
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='产品型号';

-- ----------------------------
-- Table structure for product_store
-- ----------------------------
DROP TABLE IF EXISTS `product_store`;
CREATE TABLE `product_store` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `bar_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '条形码编号',
  `action` int DEFAULT NULL COMMENT '0:出库；1入库',
  `seq` int DEFAULT NULL COMMENT '批次。一次保存使用同一值',
  `date` datetime DEFAULT NULL COMMENT '扫描时间',
  `device_sn` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `group_id` bigint DEFAULT NULL,
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `delete_flag` int DEFAULT '0' COMMENT '删除标识。0:未删除，默认值；1:已删除',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=3781 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='产品出入库';

-- ----------------------------
-- Table structure for product_type
-- ----------------------------
DROP TABLE IF EXISTS `product_type`;
CREATE TABLE `product_type` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '类型名称',
  `code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '类型码',
  `bar_prefix` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '条形码前缀',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `delete_flag` int DEFAULT '0' COMMENT '删除标识。0:未删除，默认值；1:已删除',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='产品类型';

-- ----------------------------
-- Table structure for production
-- ----------------------------
DROP TABLE IF EXISTS `production`;
CREATE TABLE `production` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group_id` bigint DEFAULT NULL,
  `product_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `product_model` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `planned_production` int DEFAULT '0' COMMENT '计划产量',
  `actual_production` int unsigned DEFAULT '0' COMMENT '实际产量',
  `date` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT '年月',
  `create_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `index_type_model_date` (`group_id`,`product_type`,`product_model`,`date`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=774 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='产品产量表';

SET FOREIGN_KEY_CHECKS = 1;
