-- migrations/002_holidays.sql

CREATE TABLE IF NOT EXISTS holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);


INSERT IGNORE INTO holidays (date, name) VALUES
-- 2026 Sri Lankan Holidays
('2026-01-01', 'New Year''s Day'),
('2026-01-14', 'Thai Pongal'),
('2026-01-15', 'Tamil Thai Pongal Day'),
('2026-02-04', 'Independence Day'),
('2026-02-16', 'Maha Sivarathri Day'),
('2026-03-05', 'Medin Full Moon Poya Day'),
('2026-03-20', 'Id-Ul-Fitr'),
('2026-04-03', 'Bak Full Moon Poya Day'),
('2026-04-10', 'Good Friday'),
('2026-04-13', 'Day prior to Sinhala & Tamil New Year'),
('2026-04-14', 'Sinhala & Tamil New Year Day'),
('2026-05-01', 'May Day'),
('2026-05-02', 'Vesak Full Moon Poya Day'),
('2026-05-03', 'Day following Vesak Full Moon Poya Day'),
('2026-05-26', 'Id-Ul-Alha (Hadji Festival Day)'),
('2026-06-01', 'Poson Full Moon Poya Day'),
('2026-06-30', 'Esala Full Moon Poya Day'),
('2026-07-30', 'Nikini Full Moon Poya Day'),
('2026-08-28', 'Binara Full Moon Poya Day'),
('2026-09-27', 'Vap Full Moon Poya Day'),
('2026-10-22', 'Deepavali Festival Day'),
('2026-10-27', 'Il Full Moon Poya Day'),
('2026-11-25', 'Unduvap Full Moon Poya Day'),
('2026-12-25', 'Christmas Day'),

-- 2027 Sri Lankan Holidays
('2027-01-01', 'New Year''s Day'),
('2027-01-14', 'Thai Pongal'),
('2027-01-15', 'Tamil Thai Pongal Day'),
('2027-02-04', 'Independence Day'),
('2027-02-22', 'Medin Full Moon Poya Day'),
('2027-03-05', 'Maha Sivarathri Day'),
('2027-03-09', 'Id-Ul-Fitr'),
('2027-03-24', 'Bak Full Moon Poya Day'),
('2027-03-26', 'Good Friday'),
('2027-04-13', 'Day prior to Sinhala & Tamil New Year'),
('2027-04-14', 'Sinhala & Tamil New Year Day'),
('2027-04-22', 'Vesak Full Moon Poya Day'),
('2027-04-23', 'Day following Vesak Full Moon Poya Day'),
('2027-05-01', 'May Day'),
('2027-05-15', 'Id-Ul-Alha (Hadji Festival Day)'),
('2027-05-21', 'Poson Full Moon Poya Day'),
('2027-06-20', 'Esala Full Moon Poya Day'),
('2027-07-19', 'Nikini Full Moon Poya Day'),
('2027-08-17', 'Binara Full Moon Poya Day'),
('2027-09-16', 'Vap Full Moon Poya Day'),
('2027-10-15', 'Il Full Moon Poya Day'),
('2027-11-10', 'Deepavali Festival Day'),
('2027-11-14', 'Unduvap Full Moon Poya Day'),
('2027-12-25', 'Christmas Day'),
('2027-12-26', 'Boxing Day');
