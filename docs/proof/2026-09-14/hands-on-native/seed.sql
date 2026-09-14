
INSERT INTO accounts(id,name,plan) VALUES(1,'ISOLATED Native Account A','trial'),(2,'ISOLATED Native Account B','trial');
INSERT INTO users(id,account_id,email,password_hash,name,role) VALUES(1,1,'native-owner-a@example.invalid','$2b$12$7OeHtcL/BkmyhSgF9Zryre93hZ1b80PkJb1L1X3GZqK8JuuEhXmqW','Native Owner A','owner'),(2,2,'native-owner-b@example.invalid','$2b$12$7OeHtcL/BkmyhSgF9Zryre93hZ1b80PkJb1L1X3GZqK8JuuEhXmqW','Native Owner B','owner'),(3,1,'native-viewer@example.invalid','$2b$12$7OeHtcL/BkmyhSgF9Zryre93hZ1b80PkJb1L1X3GZqK8JuuEhXmqW','Native Viewer','viewer'),(4,1,'native-manager@example.invalid','$2b$12$7OeHtcL/BkmyhSgF9Zryre93hZ1b80PkJb1L1X3GZqK8JuuEhXmqW','Native Manager','manager');
INSERT INTO buildings(id,account_id,address,label) VALUES(101,1,'101 Isolated Lane','Native A original'),(102,1,'102 Isolated Lane','Native restricted original'),(201,2,'201 Isolated Lane','Native B original');
INSERT INTO property_access(user_id,building_id) VALUES(4,101);
INSERT INTO units(id,account_id,building_id,label) VALUES(101,1,101,'A-101'),(102,1,102,'A-102'),(201,2,201,'B-201');
INSERT INTO receipts(id,account_id,image_data,mime) VALUES(101,1,'data:text/plain;base64,SVNPTEFURUQgTkFUSVZFIEFDQ09VTlQgQQ==','text/plain'),(201,2,'data:text/plain;base64,SVNPTEFURUQgTkFUSVZFIEFDQ09VTlQgQg==','text/plain');
