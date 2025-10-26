-- Clear existing data (delete in correct order to respect foreign key constraints)
DELETE FROM payments;
DELETE FROM ledger_entries;
DELETE FROM pnl_entries;
DELETE FROM rentals;
DELETE FROM customer_documents;
DELETE FROM reminders;
DELETE FROM customers;
DELETE FROM vehicles;

-- Insert 10 test customers
INSERT INTO customers (name, email, phone, type) VALUES
('Customer 1', 'customer1@test.com', '07700900001', 'Individual'),
('Customer 2', 'customer2@test.com', '07700900002', 'Individual'),
('Customer 3', 'customer3@test.com', '07700900003', 'Individual'),
('Customer 4', 'customer4@test.com', '07700900004', 'Individual'),
('Customer 5', 'customer5@test.com', '07700900005', 'Individual'),
('Customer 6', 'customer6@test.com', '07700900006', 'Company'),
('Customer 7', 'customer7@test.com', '07700900007', 'Company'),
('Customer 8', 'customer8@test.com', '07700900008', 'Company'),
('Customer 9', 'customer9@test.com', '07700900009', 'Individual'),
('Customer 10', 'customer10@test.com', '07700900010', 'Individual');

-- Insert 10 test vehicles
INSERT INTO vehicles (reg, make, model, year, status) VALUES
('ABC001', 'Toyota', 'Corolla', 2020, 'available'),
('ABC002', 'Honda', 'Civic', 2021, 'available'),
('ABC003', 'Ford', 'Focus', 2019, 'available'),
('ABC004', 'BMW', '3 Series', 2022, 'available'),
('ABC005', 'Audi', 'A4', 2021, 'available'),
('ABC006', 'Mercedes', 'C Class', 2020, 'available'),
('ABC007', 'VW', 'Golf', 2019, 'available'),
('ABC008', 'Tesla', 'Model 3', 2022, 'available'),
('ABC009', 'Nissan', 'Qashqai', 2021, 'available'),
('ABC010', 'Mazda', 'CX-5', 2020, 'available');
