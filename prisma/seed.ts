import { PrismaClient, EmployeeRole, EmploymentType, EmployeeStatus, WorkMode, LeaveStatus, LeaveType, HolidayTypeEnum, AssetType, AssetCategory, InventoryStatus, OvertimeStatus, DeductionStatus, SalaryChangeStatus, SalaryChangeType, DeductionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create leave type colors
  await prisma.leaveTypeColor.upsert({
    where: { leaveType: LeaveType.ANNUAL },
    update: {},
    create: {
      leaveType: LeaveType.ANNUAL,
      name: 'Annual Leave',
      hexColor: '#FFE0B2',
      shortcut: 'AL',
      description: 'Annual leave for vacation and personal time',
    },
  });

  await prisma.leaveTypeColor.upsert({
    where: { leaveType: LeaveType.SICK },
    update: {},
    create: {
      leaveType: LeaveType.SICK,
      name: 'Sick Leave',
      hexColor: '#FFCCCC',
      shortcut: 'SL',
      description: 'Sick leave for medical reasons',
    },
  });

  await prisma.leaveTypeColor.upsert({
    where: { leaveType: LeaveType.MATERNITY },
    update: {},
    create: {
      leaveType: LeaveType.MATERNITY,
      name: 'Maternity Leave',
      hexColor: '#F8BBD0',
      shortcut: 'ML',
      description: 'Maternity leave for new mothers',
    },
  });

  await prisma.leaveTypeColor.upsert({
    where: { leaveType: LeaveType.EMERGENCY },
    update: {},
    create: {
      leaveType: LeaveType.EMERGENCY,
      name: 'Emergency Leave',
      hexColor: '#FF6B6B',
      shortcut: 'EL',
      description: 'Emergency leave for urgent situations',
    },
  });

  await prisma.leaveTypeColor.upsert({
    where: { leaveType: LeaveType.TOIL },
    update: {},
    create: {
      leaveType: LeaveType.TOIL,
      name: 'Time Off In Lieu',
      hexColor: '#C5E1A5',
      shortcut: 'TOIL',
      description: 'Time off in lieu for overtime work',
    },
  });

  await prisma.leaveTypeColor.upsert({
    where: { leaveType: LeaveType.WFH },
    update: {},
    create: {
      leaveType: LeaveType.WFH,
      name: 'Work From Home',
      hexColor: '#B3E5FC',
      shortcut: 'WFH',
      description: 'Work from home day',
    },
  });

  console.log('✅ Leave type colors created');

  // Create departments
  const hrDept = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: {
      name: 'Human Resources',
      code: 'HR',
      description: 'Human Resources Department',
    },
  });

  const itDept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: {
      name: 'Information Technology',
      code: 'IT',
      description: 'IT Department',
    },
  });

  await prisma.department.upsert({
    where: { code: 'FIN' },
    update: {},
    create: {
      name: 'Finance',
      code: 'FIN',
      description: 'Finance Department',
    },
  });

  console.log('✅ Departments created');

  // Get Finance department
  const finDept = await prisma.department.findUnique({
    where: { code: 'FIN' },
  });

  // ============================================
  // CREATE EMPLOYEES FOR EACH ROLE
  // ============================================

  // ADMIN ROLE - Fatima Al-Mansouri
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminEmployee = await prisma.employee.upsert({
    where: { email: 'fatima.almansouri@yazmedia.com' },
    update: {},
    create: {
      email: 'fatima.almansouri@yazmedia.com',
      password: adminPassword,
      firstName: 'Fatima',
      lastName: 'Al-Mansouri',
      personalEmail: 'fatima.mansouri@gmail.com',
      phone: '+971501234567',
      dateOfBirth: new Date('1985-03-15'),
      gender: 'Female',
      address: 'Villa 45, Al Wasl Road',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '12345',
      country: 'UAE',
      employeeId: 'ADMIN001',
      departmentId: hrDept.id,
      designation: 'System Administrator',
      role: EmployeeRole.ADMIN,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      workMode: WorkMode.ON_SITE,
      joinDate: new Date('2022-01-10'),
      baseSalary: 8000,
      accommodation: 3000,
      transportation: 2000,
      totalSalary: 13000,
      currency: 'AED',
    },
  });

  console.log('✅ Admin employee (Fatima Al-Mansouri) created');

  // HR ROLE - Sarah Johnson
  const hrPassword = await bcrypt.hash('hr123', 10);
  const hrEmployee = await prisma.employee.upsert({
    where: { email: 'sarah.johnson@yazmedia.com' },
    update: {},
    create: {
      email: 'sarah.johnson@yazmedia.com',
      password: hrPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      personalEmail: 'sarah.j@gmail.com',
      phone: '+971502345678',
      dateOfBirth: new Date('1990-07-22'),
      gender: 'Female',
      address: 'Apartment 102, Marina Heights',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '54321',
      country: 'UAE',
      employeeId: 'EMP001',
      departmentId: hrDept.id,
      designation: 'HR Manager',
      role: EmployeeRole.HR,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      workMode: WorkMode.HYBRID,
      joinDate: new Date('2022-03-15'),
      baseSalary: 6500,
      accommodation: 2500,
      transportation: 1500,
      totalSalary: 10500,
      currency: 'AED',
    },
  });

  console.log('✅ HR employee (Sarah Johnson) created');

  // MANAGEMENT ROLE - Ahmed Hassan
  const mgmtPassword = await bcrypt.hash('mgmt123', 10);
  const mgmtEmployee = await prisma.employee.upsert({
    where: { email: 'ahmed.hassan@yazmedia.com' },
    update: {},
    create: {
      email: 'ahmed.hassan@yazmedia.com',
      password: mgmtPassword,
      firstName: 'Ahmed',
      lastName: 'Hassan',
      personalEmail: 'ahmed.hassan@outlook.com',
      phone: '+971503456789',
      dateOfBirth: new Date('1988-05-10'),
      gender: 'Male',
      address: 'Office Tower B, Business Bay',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '67890',
      country: 'UAE',
      employeeId: 'EMP004',
      departmentId: itDept.id,
      designation: 'IT Manager',
      role: EmployeeRole.MANAGEMENT,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      workMode: WorkMode.HYBRID,
      joinDate: new Date('2021-06-01'),
      baseSalary: 9000,
      accommodation: 3500,
      transportation: 2000,
      totalSalary: 14500,
      currency: 'AED',
    },
  });

  console.log('✅ Management employee (Ahmed Hassan) created');

  // FINANCE ROLE - Emma Wilson
  const finPassword = await bcrypt.hash('fin123', 10);
  const finEmployee = await prisma.employee.upsert({
    where: { email: 'emma.wilson@yazmedia.com' },
    update: {},
    create: {
      email: 'emma.wilson@yazmedia.com',
      password: finPassword,
      firstName: 'Emma',
      lastName: 'Wilson',
      personalEmail: 'emma.w@gmail.com',
      phone: '+971504567890',
      dateOfBirth: new Date('1992-11-28'),
      gender: 'Female',
      address: 'Flat 5, Downtown Dubai',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '11111',
      country: 'UAE',
      employeeId: 'EMP005',
      departmentId: finDept!.id,
      designation: 'Finance Manager',
      role: EmployeeRole.FINANCE,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      workMode: WorkMode.ON_SITE,
      joinDate: new Date('2022-02-20'),
      baseSalary: 7500,
      accommodation: 3000,
      transportation: 1500,
      totalSalary: 12000,
      currency: 'AED',
    },
  });

  console.log('✅ Finance employee (Emma Wilson) created');

  // EMPLOYEE ROLE - John Doe (Senior Developer)
  const itPassword = await bcrypt.hash('it123', 10);
  const itEmployee = await prisma.employee.upsert({
    where: { email: 'john.doe@yazmedia.com' },
    update: {},
    create: {
      email: 'john.doe@yazmedia.com',
      password: itPassword,
      firstName: 'John',
      lastName: 'Doe',
      personalEmail: 'john.doe@gmail.com',
      phone: '+971505678901',
      dateOfBirth: new Date('1989-09-14'),
      gender: 'Male',
      address: 'Villa 12, JBR',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '22222',
      country: 'UAE',
      employeeId: 'EMP002',
      departmentId: itDept.id,
      designation: 'Senior Developer',
      role: EmployeeRole.EMPLOYEE,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      workMode: WorkMode.REMOTE,
      joinDate: new Date('2021-08-01'),
      baseSalary: 8500,
      accommodation: 3500,
      transportation: 2000,
      totalSalary: 14000,
      currency: 'AED',
      managerId: mgmtEmployee.id,
    },
  });

  console.log('✅ Employee (John Doe - Senior Developer) created');

  // EMPLOYEE ROLE - Priya Sharma (Junior Developer)
  const juniorDevPassword = await bcrypt.hash('junior123', 10);
  const juniorDevEmployee = await prisma.employee.upsert({
    where: { email: 'priya.sharma@yazmedia.com' },
    update: {},
    create: {
      email: 'priya.sharma@yazmedia.com',
      password: juniorDevPassword,
      firstName: 'Priya',
      lastName: 'Sharma',
      personalEmail: 'priya.sharma@gmail.com',
      phone: '+971506789012',
      dateOfBirth: new Date('1998-02-03'),
      gender: 'Female',
      address: 'Apartment 8, Al Manara',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '33333',
      country: 'UAE',
      employeeId: 'EMP006',
      departmentId: itDept.id,
      designation: 'Junior Developer',
      role: EmployeeRole.EMPLOYEE,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      workMode: WorkMode.HYBRID,
      joinDate: new Date('2023-09-15'),
      baseSalary: 6000,
      accommodation: 2000,
      transportation: 1000,
      totalSalary: 9000,
      currency: 'AED',
      managerId: mgmtEmployee.id,
    },
  });

  console.log('✅ Employee (Priya Sharma - Junior Developer) created');

  // EMPLOYEE ROLE - Michael Chen (QA Engineer)
  const qaPassword = await bcrypt.hash('qa123', 10);
  const qaEmployee = await prisma.employee.upsert({
    where: { email: 'michael.chen@yazmedia.com' },
    update: {},
    create: {
      email: 'michael.chen@yazmedia.com',
      password: qaPassword,
      firstName: 'Michael',
      lastName: 'Chen',
      personalEmail: 'michael.chen@gmail.com',
      phone: '+971507890123',
      dateOfBirth: new Date('1991-12-20'),
      gender: 'Male',
      address: 'Studio, Dubai Marina',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '44444',
      country: 'UAE',
      employeeId: 'EMP007',
      departmentId: itDept.id,
      designation: 'QA Engineer',
      role: EmployeeRole.EMPLOYEE,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      workMode: WorkMode.ON_SITE,
      joinDate: new Date('2022-11-10'),
      baseSalary: 7000,
      accommodation: 2500,
      transportation: 1500,
      totalSalary: 11000,
      currency: 'AED',
      managerId: mgmtEmployee.id,
    },
  });

  console.log('✅ Employee (Michael Chen - QA Engineer) created');

  // EMPLOYEE ROLE - Layla Al-Zahra (HR Specialist)
  const hrSpecPassword = await bcrypt.hash('hrspec123', 10);
  const hrSpecEmployee = await prisma.employee.upsert({
    where: { email: 'layla.alzahra@yazmedia.com' },
    update: {},
    create: {
      email: 'layla.alzahra@yazmedia.com',
      password: hrSpecPassword,
      firstName: 'Layla',
      lastName: 'Al-Zahra',
      personalEmail: 'layla.zahra@gmail.com',
      phone: '+971508901234',
      dateOfBirth: new Date('1994-06-18'),
      gender: 'Female',
      address: 'Apartment 15, Al Baraka',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '55555',
      country: 'UAE',
      employeeId: 'EMP008',
      departmentId: hrDept.id,
      designation: 'HR Specialist',
      role: EmployeeRole.EMPLOYEE,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      workMode: WorkMode.HYBRID,
      joinDate: new Date('2023-01-20'),
      baseSalary: 5500,
      accommodation: 2000,
      transportation: 1000,
      totalSalary: 8500,
      currency: 'AED',
      managerId: hrEmployee.id,
    },
  });

  console.log('✅ Employee (Layla Al-Zahra - HR Specialist) created');

  // EMPLOYEE ROLE - David Martinez (Finance Officer)
  const finOfficerPassword = await bcrypt.hash('finofficer123', 10);
  const finOfficerEmployee = await prisma.employee.upsert({
    where: { email: 'david.martinez@yazmedia.com' },
    update: {},
    create: {
      email: 'david.martinez@yazmedia.com',
      password: finOfficerPassword,
      firstName: 'David',
      lastName: 'Martinez',
      personalEmail: 'david.m@gmail.com',
      phone: '+971509012345',
      dateOfBirth: new Date('1987-04-25'),
      gender: 'Male',
      address: 'Villa 8, Arabian Ranches',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '66666',
      country: 'UAE',
      employeeId: 'EMP009',
      departmentId: finDept!.id,
      designation: 'Finance Officer',
      role: EmployeeRole.EMPLOYEE,
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      workMode: WorkMode.ON_SITE,
      joinDate: new Date('2022-05-15'),
      baseSalary: 6500,
      accommodation: 2500,
      transportation: 1500,
      totalSalary: 10500,
      currency: 'AED',
      managerId: finEmployee.id,
    },
  });

  console.log('✅ Employee (David Martinez - Finance Officer) created');

  // ============================================
  // CREATE BANK DETAILS FOR ALL EMPLOYEES
  // ============================================

  // Admin - Fatima Al-Mansouri
  await prisma.employeeBank.upsert({
    where: { employeeId: adminEmployee.id },
    update: {},
    create: {
      employeeId: adminEmployee.id,
      paymentMethod: 'Bank Transfer',
      bankName: 'Emirates NBD',
      accountHolderName: 'Fatima Al-Mansouri',
      iban: 'AE070331234567890123456',
      routingNumber: '400010',
    },
  });

  // HR - Sarah Johnson
  await prisma.employeeBank.upsert({
    where: { employeeId: hrEmployee.id },
    update: {},
    create: {
      employeeId: hrEmployee.id,
      paymentMethod: 'Bank Transfer',
      bankName: 'FAB - First Abu Dhabi Bank',
      accountHolderName: 'Sarah Johnson',
      iban: 'AE230020000000123456789',
      routingNumber: '400020',
    },
  });

  // Management - Ahmed Hassan
  await prisma.employeeBank.upsert({
    where: { employeeId: mgmtEmployee.id },
    update: {},
    create: {
      employeeId: mgmtEmployee.id,
      paymentMethod: 'Bank Transfer',
      bankName: 'ADIB - Abu Dhabi Islamic Bank',
      accountHolderName: 'Ahmed Hassan',
      iban: 'AE460020000000234567890',
      routingNumber: '400030',
    },
  });

  // Finance - Emma Wilson
  await prisma.employeeBank.upsert({
    where: { employeeId: finEmployee.id },
    update: {},
    create: {
      employeeId: finEmployee.id,
      paymentMethod: 'Bank Transfer',
      bankName: 'DIB - Dubai Islamic Bank',
      accountHolderName: 'Emma Wilson',
      iban: 'AE650020000000345678901',
      routingNumber: '400040',
    },
  });

  // Employee - John Doe
  await prisma.employeeBank.upsert({
    where: { employeeId: itEmployee.id },
    update: {},
    create: {
      employeeId: itEmployee.id,
      paymentMethod: 'Bank Transfer',
      bankName: 'RAK Bank',
      accountHolderName: 'John Doe',
      iban: 'AE840020000000456789012',
      routingNumber: '400050',
    },
  });

  // Employee - Priya Sharma
  await prisma.employeeBank.upsert({
    where: { employeeId: juniorDevEmployee.id },
    update: {},
    create: {
      employeeId: juniorDevEmployee.id,
      paymentMethod: 'Bank Transfer',
      bankName: 'Mashreq Bank',
      accountHolderName: 'Priya Sharma',
      iban: 'AE030020000000567890123',
      routingNumber: '400060',
    },
  });

  // Employee - Michael Chen
  await prisma.employeeBank.upsert({
    where: { employeeId: qaEmployee.id },
    update: {},
    create: {
      employeeId: qaEmployee.id,
      paymentMethod: 'Bank Transfer',
      bankName: 'ENBD - Emirates NBD',
      accountHolderName: 'Michael Chen',
      iban: 'AE120020000000678901234',
      routingNumber: '400070',
    },
  });

  // Employee - Layla Al-Zahra
  await prisma.employeeBank.upsert({
    where: { employeeId: hrSpecEmployee.id },
    update: {},
    create: {
      employeeId: hrSpecEmployee.id,
      paymentMethod: 'Bank Transfer',
      bankName: 'FAB - First Abu Dhabi Bank',
      accountHolderName: 'Layla Al-Zahra',
      iban: 'AE410020000000789012345',
      routingNumber: '400080',
    },
  });

  // Employee - David Martinez
  await prisma.employeeBank.upsert({
    where: { employeeId: finOfficerEmployee.id },
    update: {},
    create: {
      employeeId: finOfficerEmployee.id,
      paymentMethod: 'Bank Transfer',
      bankName: 'ADIB - Abu Dhabi Islamic Bank',
      accountHolderName: 'David Martinez',
      iban: 'AE500020000000890123456',
      routingNumber: '400090',
    },
  });

  console.log('✅ Bank details created for all employees');

  // ============================================
  // CREATE EMPLOYEE DOCUMENTS
  // ============================================

  // Admin - Fatima Al-Mansouri
  await prisma.employeeDocument.upsert({
    where: { id: 'doc_emp_admin_001' },
    update: {},
    create: {
      id: 'doc_emp_admin_001',
      employeeId: adminEmployee.id,
      documentType: 'EMIRATES_ID',
      name: 'Emirates ID - Fatima Al-Mansouri',
      url: 'https://storage.example.com/documents/fatima_emirates_id.pdf',
    },
  });

  await prisma.employeeDocument.upsert({
    where: { id: 'doc_emp_admin_002' },
    update: {},
    create: {
      id: 'doc_emp_admin_002',
      employeeId: adminEmployee.id,
      documentType: 'PASSPORT',
      name: 'Passport - Fatima Al-Mansouri',
      url: 'https://storage.example.com/documents/fatima_passport.pdf',
    },
  });

  // HR - Sarah Johnson
  await prisma.employeeDocument.upsert({
    where: { id: 'doc_emp_hr_001' },
    update: {},
    create: {
      id: 'doc_emp_hr_001',
      employeeId: hrEmployee.id,
      documentType: 'PASSPORT',
      name: 'Passport - Sarah Johnson',
      url: 'https://storage.example.com/documents/sarah_passport.pdf',
    },
  });

  await prisma.employeeDocument.upsert({
    where: { id: 'doc_emp_hr_002' },
    update: {},
    create: {
      id: 'doc_emp_hr_002',
      employeeId: hrEmployee.id,
      documentType: 'CERTIFICATE',
      name: 'HR Certification - CIPD Level 3',
      url: 'https://storage.example.com/documents/sarah_cipd_cert.pdf',
    },
  });

  // IT Employee - John Doe
  await prisma.employeeDocument.upsert({
    where: { id: 'doc_emp_it_001' },
    update: {},
    create: {
      id: 'doc_emp_it_001',
      employeeId: itEmployee.id,
      documentType: 'PASSPORT',
      name: 'Passport - John Doe',
      url: 'https://storage.example.com/documents/john_passport.pdf',
    },
  });

  await prisma.employeeDocument.upsert({
    where: { id: 'doc_emp_it_002' },
    update: {},
    create: {
      id: 'doc_emp_it_002',
      employeeId: itEmployee.id,
      documentType: 'CERTIFICATE',
      name: 'AWS Solutions Architect Certification',
      url: 'https://storage.example.com/documents/john_aws_cert.pdf',
    },
  });

  console.log('✅ Employee documents created');

  // ============================================
  // CREATE LEAVE SUMMARIES FOR ALL EMPLOYEES
  // ============================================

  const currentYear = new Date().getFullYear();

  // Admin - Fatima Al-Mansouri
  await prisma.leaveSummary.upsert({
    where: { employeeId_year: { employeeId: adminEmployee.id, year: currentYear } },
    update: {},
    create: {
      employeeId: adminEmployee.id,
      year: currentYear,
      annualLeave: 20,
      sickLeave: 10,
      maternityLeave: 0,
      emergencyLeave: 5,
      toilLeave: 2,
      wfhLeave: 10,
    },
  });

  // HR - Sarah Johnson
  await prisma.leaveSummary.upsert({
    where: { employeeId_year: { employeeId: hrEmployee.id, year: currentYear } },
    update: {},
    create: {
      employeeId: hrEmployee.id,
      year: currentYear,
      annualLeave: 20,
      sickLeave: 10,
      maternityLeave: 0,
      emergencyLeave: 5,
      toilLeave: 1,
      wfhLeave: 10,
    },
  });

  // Management - Ahmed Hassan
  await prisma.leaveSummary.upsert({
    where: { employeeId_year: { employeeId: mgmtEmployee.id, year: currentYear } },
    update: {},
    create: {
      employeeId: mgmtEmployee.id,
      year: currentYear,
      annualLeave: 20,
      sickLeave: 10,
      maternityLeave: 0,
      emergencyLeave: 5,
      toilLeave: 3,
      wfhLeave: 10,
    },
  });

  // Finance - Emma Wilson
  await prisma.leaveSummary.upsert({
    where: { employeeId_year: { employeeId: finEmployee.id, year: currentYear } },
    update: {},
    create: {
      employeeId: finEmployee.id,
      year: currentYear,
      annualLeave: 20,
      sickLeave: 10,
      maternityLeave: 0,
      emergencyLeave: 5,
      toilLeave: 0,
      wfhLeave: 10,
    },
  });

  // Employee - John Doe
  await prisma.leaveSummary.upsert({
    where: { employeeId_year: { employeeId: itEmployee.id, year: currentYear } },
    update: {},
    create: {
      employeeId: itEmployee.id,
      year: currentYear,
      annualLeave: 20,
      sickLeave: 10,
      maternityLeave: 0,
      emergencyLeave: 5,
      toilLeave: 4,
      wfhLeave: 10,
    },
  });

  // Employee - Priya Sharma
  await prisma.leaveSummary.upsert({
    where: { employeeId_year: { employeeId: juniorDevEmployee.id, year: currentYear } },
    update: {},
    create: {
      employeeId: juniorDevEmployee.id,
      year: currentYear,
      annualLeave: 20,
      sickLeave: 10,
      maternityLeave: 0,
      emergencyLeave: 5,
      toilLeave: 0,
      wfhLeave: 10,
    },
  });

  // Employee - Michael Chen
  await prisma.leaveSummary.upsert({
    where: { employeeId_year: { employeeId: qaEmployee.id, year: currentYear } },
    update: {},
    create: {
      employeeId: qaEmployee.id,
      year: currentYear,
      annualLeave: 20,
      sickLeave: 10,
      maternityLeave: 0,
      emergencyLeave: 5,
      toilLeave: 1,
      wfhLeave: 10,
    },
  });

  // Employee - Layla Al-Zahra
  await prisma.leaveSummary.upsert({
    where: { employeeId_year: { employeeId: hrSpecEmployee.id, year: currentYear } },
    update: {},
    create: {
      employeeId: hrSpecEmployee.id,
      year: currentYear,
      annualLeave: 20,
      sickLeave: 10,
      maternityLeave: 0,
      emergencyLeave: 5,
      toilLeave: 0,
      wfhLeave: 10,
    },
  });

  // Employee - David Martinez
  await prisma.leaveSummary.upsert({
    where: { employeeId_year: { employeeId: finOfficerEmployee.id, year: currentYear } },
    update: {},
    create: {
      employeeId: finOfficerEmployee.id,
      year: currentYear,
      annualLeave: 20,
      sickLeave: 10,
      maternityLeave: 0,
      emergencyLeave: 5,
      toilLeave: 0,
      wfhLeave: 10,
    },
  });

  console.log('✅ Leave summaries created for all employees');

  // ============================================
  // CREATE ATTENDANCE RECORDS
  // ============================================

  // Admin - Fatima Al-Mansouri (Last 5 days)
  for (let i = 5; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: adminEmployee.id, date: date } },
      update: {},
      create: {
        employeeId: adminEmployee.id,
        date: date,
        checkInTime: new Date(date.getTime() + 8 * 60 * 60 * 1000),
        checkOutTime: new Date(date.getTime() + 17 * 60 * 60 * 1000),
        hoursWorked: 8,
        overtime: 0,
      },
    });
  }

  // HR - Sarah Johnson (Last 5 days)
  for (let i = 5; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: hrEmployee.id, date: date } },
      update: {},
      create: {
        employeeId: hrEmployee.id,
        date: date,
        checkInTime: new Date(date.getTime() + 8.5 * 60 * 60 * 1000),
        checkOutTime: new Date(date.getTime() + 17.5 * 60 * 60 * 1000),
        hoursWorked: 8,
        overtime: 0.5,
      },
    });
  }

  // IT Employee - John Doe (Last 5 days)
  for (let i = 5; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: itEmployee.id, date: date } },
      update: {},
      create: {
        employeeId: itEmployee.id,
        date: date,
        checkInTime: new Date(date.getTime() + 9 * 60 * 60 * 1000),
        checkOutTime: new Date(date.getTime() + 18 * 60 * 60 * 1000),
        hoursWorked: 8,
        overtime: 1,
      },
    });
  }

  // QA - Michael Chen (Last 5 days)
  for (let i = 5; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: qaEmployee.id, date: date } },
      update: {},
      create: {
        employeeId: qaEmployee.id,
        date: date,
        checkInTime: new Date(date.getTime() + 8 * 60 * 60 * 1000),
        checkOutTime: new Date(date.getTime() + 17 * 60 * 60 * 1000),
        hoursWorked: 8,
        overtime: 0,
      },
    });
  }

  console.log('✅ Attendance records created');

  // ============================================
  // CREATE LEAVE REQUESTS FOR ALL EMPLOYEES
  // ============================================

  // Admin - Fatima Al-Mansouri - Approved annual leave
  await prisma.leaveRequest.upsert({
    where: { id: 'leave_001' },
    update: {},
    create: {
      id: 'leave_001',
      employeeId: adminEmployee.id,
      leaveType: LeaveType.ANNUAL,
      startDate: new Date('2025-12-20'),
      endDate: new Date('2025-12-31'),
      numberOfDays: 12,
      reason: 'Year-end holiday break',
      status: LeaveStatus.APPROVED,
      approvedBy: adminEmployee.id,
      approvalDate: new Date('2025-10-15T15:45:00Z'),
      createdAt: new Date('2025-10-15T11:00:00Z'),
    },
  });

  // HR - Sarah Johnson - Pending annual leave
  await prisma.leaveRequest.upsert({
    where: { id: 'leave_002' },
    update: {},
    create: {
      id: 'leave_002',
      employeeId: hrEmployee.id,
      leaveType: LeaveType.ANNUAL,
      startDate: new Date('2025-11-10'),
      endDate: new Date('2025-11-14'),
      numberOfDays: 5,
      reason: 'Family vacation to Dubai',
      status: LeaveStatus.PENDING,
      createdAt: new Date('2025-10-20T10:30:00Z'),
    },
  });

  // Management - Ahmed Hassan - Approved WFH
  await prisma.leaveRequest.upsert({
    where: { id: 'leave_003' },
    update: {},
    create: {
      id: 'leave_003',
      employeeId: mgmtEmployee.id,
      leaveType: LeaveType.WFH,
      startDate: new Date('2025-10-22'),
      endDate: new Date('2025-10-22'),
      numberOfDays: 1,
      reason: 'Working from home - team meeting preparation',
      status: LeaveStatus.APPROVED,
      approvedBy: adminEmployee.id,
      approvalDate: new Date('2025-10-19T14:00:00Z'),
      createdAt: new Date('2025-10-19T13:20:00Z'),
    },
  });

  // Finance - Emma Wilson - Rejected emergency leave
  await prisma.leaveRequest.upsert({
    where: { id: 'leave_004' },
    update: {},
    create: {
      id: 'leave_004',
      employeeId: finEmployee.id,
      leaveType: LeaveType.EMERGENCY,
      startDate: new Date('2025-10-21'),
      endDate: new Date('2025-10-21'),
      numberOfDays: 1,
      reason: 'Family emergency',
      status: LeaveStatus.REJECTED,
      approvedBy: adminEmployee.id,
      approvalDate: new Date('2025-10-20T09:30:00Z'),
      rejectionReason: 'Insufficient documentation provided',
      createdAt: new Date('2025-10-20T08:00:00Z'),
    },
  });

  // Employee - John Doe - Approved sick leave
  await prisma.leaveRequest.upsert({
    where: { id: 'leave_005' },
    update: {},
    create: {
      id: 'leave_005',
      employeeId: itEmployee.id,
      leaveType: LeaveType.SICK,
      startDate: new Date('2025-10-18'),
      endDate: new Date('2025-10-19'),
      numberOfDays: 2,
      reason: 'Medical appointment and recovery',
      status: LeaveStatus.APPROVED,
      approvedBy: mgmtEmployee.id,
      approvalDate: new Date('2025-10-17T14:30:00Z'),
      createdAt: new Date('2025-10-17T09:15:00Z'),
    },
  });

  // Employee - Priya Sharma - Pending TOIL
  await prisma.leaveRequest.upsert({
    where: { id: 'leave_006' },
    update: {},
    create: {
      id: 'leave_006',
      employeeId: juniorDevEmployee.id,
      leaveType: LeaveType.TOIL,
      startDate: new Date('2025-10-25'),
      endDate: new Date('2025-10-25'),
      numberOfDays: 1,
      reason: 'Time off in lieu - weekend work compensation',
      status: LeaveStatus.PENDING,
      createdAt: new Date('2025-10-20T16:45:00Z'),
    },
  });

  // Employee - Michael Chen - Approved annual leave
  await prisma.leaveRequest.upsert({
    where: { id: 'leave_007' },
    update: {},
    create: {
      id: 'leave_007',
      employeeId: qaEmployee.id,
      leaveType: LeaveType.ANNUAL,
      startDate: new Date('2025-11-15'),
      endDate: new Date('2025-11-20'),
      numberOfDays: 6,
      reason: 'Personal vacation',
      status: LeaveStatus.APPROVED,
      approvedBy: mgmtEmployee.id,
      approvalDate: new Date('2025-10-18T10:00:00Z'),
      createdAt: new Date('2025-10-17T09:00:00Z'),
    },
  });

  // Employee - Layla Al-Zahra - Approved WFH
  await prisma.leaveRequest.upsert({
    where: { id: 'leave_008' },
    update: {},
    create: {
      id: 'leave_008',
      employeeId: hrSpecEmployee.id,
      leaveType: LeaveType.WFH,
      startDate: new Date('2025-10-23'),
      endDate: new Date('2025-10-23'),
      numberOfDays: 1,
      reason: 'Working from home - recruitment interviews',
      status: LeaveStatus.APPROVED,
      approvedBy: hrEmployee.id,
      approvalDate: new Date('2025-10-20T11:00:00Z'),
      createdAt: new Date('2025-10-20T10:15:00Z'),
    },
  });

  // Employee - David Martinez - Pending annual leave
  await prisma.leaveRequest.upsert({
    where: { id: 'leave_009' },
    update: {},
    create: {
      id: 'leave_009',
      employeeId: finOfficerEmployee.id,
      leaveType: LeaveType.ANNUAL,
      startDate: new Date('2025-11-24'),
      endDate: new Date('2025-11-28'),
      numberOfDays: 5,
      reason: 'Thanksgiving holiday',
      status: LeaveStatus.PENDING,
      createdAt: new Date('2025-10-21T09:00:00Z'),
    },
  });

  console.log('✅ Leave requests created for all employees');

  // ============================================
  // CREATE ANNOUNCEMENTS
  // ============================================

  // Announcement 1 - Company-wide announcement by Admin
  const announcement1 = await prisma.announcement.upsert({
    where: { id: 'announcement_001' },
    update: {},
    create: {
      id: 'announcement_001',
      createdBy: adminEmployee.id,
      title: 'Q4 2025 Performance Review Schedule',
      content: 'Dear Team,\n\nWe are pleased to announce the Q4 2025 performance review schedule. All employees will have their reviews completed by November 30, 2025. Please schedule your meetings with your managers.\n\nBest regards,\nHR Team',
      priority: 'HIGH',
      status: 'PUBLISHED',
      publishedAt: new Date('2025-10-20T09:00:00Z'),
      createdAt: new Date('2025-10-20T08:30:00Z'),
    },
  });

  // Announcement 2 - IT Department announcement by Ahmed Hassan
  const announcement2 = await prisma.announcement.upsert({
    where: { id: 'announcement_002' },
    update: {},
    create: {
      id: 'announcement_002',
      createdBy: mgmtEmployee.id,
      title: 'System Maintenance - October 25, 2025',
      content: 'Attention IT Team,\n\nPlanned system maintenance will occur on October 25, 2025 from 10:00 PM to 2:00 AM. Please ensure all work is saved and systems are properly shut down.\n\nThank you for your cooperation.',
      priority: 'MEDIUM',
      status: 'PUBLISHED',
      publishedAt: new Date('2025-10-21T10:00:00Z'),
      createdAt: new Date('2025-10-21T09:30:00Z'),
    },
  });

  // Announcement 3 - Finance Department announcement by Emma Wilson
  const announcement3 = await prisma.announcement.upsert({
    where: { id: 'announcement_003' },
    update: {},
    create: {
      id: 'announcement_003',
      createdBy: finEmployee.id,
      title: 'October Expense Report Deadline',
      content: 'Dear Finance Team,\n\nPlease submit all October expense reports by October 31, 2025. Reports submitted after this date will be processed in the next cycle.\n\nThank you.',
      priority: 'MEDIUM',
      status: 'PUBLISHED',
      publishedAt: new Date('2025-10-21T11:00:00Z'),
      createdAt: new Date('2025-10-21T10:30:00Z'),
    },
  });

  // Announcement 4 - HR announcement by Sarah Johnson
  const announcement4 = await prisma.announcement.upsert({
    where: { id: 'announcement_004' },
    update: {},
    create: {
      id: 'announcement_004',
      createdBy: hrEmployee.id,
      title: 'New Employee Onboarding Program',
      content: 'We are excited to announce the launch of our new employee onboarding program. This program will help new team members integrate smoothly into our organization.\n\nFor more information, please contact the HR department.',
      priority: 'LOW',
      status: 'DRAFT',
      createdAt: new Date('2025-10-21T12:00:00Z'),
    },
  });

  // Link announcements to departments
  await prisma.announcementDepartment.upsert({
    where: { id: 'ann_dept_001' },
    update: {},
    create: {
      id: 'ann_dept_001',
      announcementId: announcement1.id,
      departmentId: hrDept.id,
    },
  });

  await prisma.announcementDepartment.upsert({
    where: { id: 'ann_dept_002' },
    update: {},
    create: {
      id: 'ann_dept_002',
      announcementId: announcement1.id,
      departmentId: itDept.id,
    },
  });

  await prisma.announcementDepartment.upsert({
    where: { id: 'ann_dept_003' },
    update: {},
    create: {
      id: 'ann_dept_003',
      announcementId: announcement1.id,
      departmentId: finDept!.id,
    },
  });

  await prisma.announcementDepartment.upsert({
    where: { id: 'ann_dept_004' },
    update: {},
    create: {
      id: 'ann_dept_004',
      announcementId: announcement2.id,
      departmentId: itDept.id,
    },
  });

  await prisma.announcementDepartment.upsert({
    where: { id: 'ann_dept_005' },
    update: {},
    create: {
      id: 'ann_dept_005',
      announcementId: announcement3.id,
      departmentId: finDept!.id,
    },
  });

  await prisma.announcementDepartment.upsert({
    where: { id: 'ann_dept_006' },
    update: {},
    create: {
      id: 'ann_dept_006',
      announcementId: announcement4.id,
      departmentId: hrDept.id,
    },
  });

  console.log('✅ Announcements created');

  // Create mock documents for leave requests
  // Documents for leave_001 (Pending annual leave - Sarah Johnson)
  await prisma.leaveRequestDocument.upsert({
    where: { id: 'doc_001' },
    update: {},
    create: {
      id: 'doc_001',
      leaveRequestId: 'leave_001',
      fileName: 'flight_booking_confirmation.pdf',
      fileType: 'application/pdf',
      url: 'https://storage.example.com/documents/flight_booking_confirmation_001.pdf',
      uploadDate: new Date('2025-10-20T11:00:00Z'),
    },
  });

  await prisma.leaveRequestDocument.upsert({
    where: { id: 'doc_002' },
    update: {},
    create: {
      id: 'doc_002',
      leaveRequestId: 'leave_001',
      fileName: 'hotel_reservation.pdf',
      fileType: 'application/pdf',
      url: 'https://storage.example.com/documents/hotel_reservation_001.pdf',
      uploadDate: new Date('2025-10-20T11:05:00Z'),
    },
  });

  // Documents for leave_002 (Approved sick leave - John Doe)
  await prisma.leaveRequestDocument.upsert({
    where: { id: 'doc_003' },
    update: {},
    create: {
      id: 'doc_003',
      leaveRequestId: 'leave_002',
      fileName: 'medical_certificate.pdf',
      fileType: 'application/pdf',
      url: 'https://storage.example.com/documents/medical_certificate_002.pdf',
      uploadDate: new Date('2025-10-17T10:30:00Z'),
    },
  });

  await prisma.leaveRequestDocument.upsert({
    where: { id: 'doc_004' },
    update: {},
    create: {
      id: 'doc_004',
      leaveRequestId: 'leave_002',
      fileName: 'doctor_prescription.jpg',
      fileType: 'image/jpeg',
      url: 'https://storage.example.com/documents/doctor_prescription_002.jpg',
      uploadDate: new Date('2025-10-17T10:35:00Z'),
    },
  });

  // Documents for leave_003 (Approved annual leave - Admin User)
  await prisma.leaveRequestDocument.upsert({
    where: { id: 'doc_005' },
    update: {},
    create: {
      id: 'doc_005',
      leaveRequestId: 'leave_003',
      fileName: 'travel_itinerary.pdf',
      fileType: 'application/pdf',
      url: 'https://storage.example.com/documents/travel_itinerary_003.pdf',
      uploadDate: new Date('2025-10-15T12:00:00Z'),
    },
  });

  // Documents for leave_004 (Rejected emergency leave - Emma Finance)
  await prisma.leaveRequestDocument.upsert({
    where: { id: 'doc_006' },
    update: {},
    create: {
      id: 'doc_006',
      leaveRequestId: 'leave_004',
      fileName: 'emergency_letter.pdf',
      fileType: 'application/pdf',
      url: 'https://storage.example.com/documents/emergency_letter_004.pdf',
      uploadDate: new Date('2025-10-20T08:15:00Z'),
    },
  });

  // Documents for leave_005 (Approved WFH - Emma Finance)
  await prisma.leaveRequestDocument.upsert({
    where: { id: 'doc_007' },
    update: {},
    create: {
      id: 'doc_007',
      leaveRequestId: 'leave_005',
      fileName: 'work_from_home_setup.png',
      fileType: 'image/png',
      url: 'https://storage.example.com/documents/wfh_setup_005.png',
      uploadDate: new Date('2025-10-19T13:30:00Z'),
    },
  });

  // Documents for leave_006 (Pending TOIL - John Doe)
  await prisma.leaveRequestDocument.upsert({
    where: { id: 'doc_008' },
    update: {},
    create: {
      id: 'doc_008',
      leaveRequestId: 'leave_006',
      fileName: 'weekend_work_log.pdf',
      fileType: 'application/pdf',
      url: 'https://storage.example.com/documents/weekend_work_log_006.pdf',
      uploadDate: new Date('2025-10-20T17:00:00Z'),
    },
  });

  await prisma.leaveRequestDocument.upsert({
    where: { id: 'doc_009' },
    update: {},
    create: {
      id: 'doc_009',
      leaveRequestId: 'leave_006',
      fileName: 'project_completion_screenshot.png',
      fileType: 'image/png',
      url: 'https://storage.example.com/documents/project_screenshot_006.png',
      uploadDate: new Date('2025-10-20T17:05:00Z'),
    },
  });

  console.log('✅ Leave request documents created');

  // Create holiday types
  const publicHolidayType = await prisma.holidayType.upsert({
    where: { name: 'Public Holiday' },
    update: {},
    create: {
      name: 'Public Holiday',
      description: 'Official public holidays',
      type: HolidayTypeEnum.PUBLIC_HOLIDAY,
    },
  });

  const companyHolidayType = await prisma.holidayType.upsert({
    where: { name: 'Company Holiday' },
    update: {},
    create: {
      name: 'Company Holiday',
      description: 'Company-specific holidays',
      type: HolidayTypeEnum.COMPANY_HOLIDAY,
    },
  });

  console.log('✅ Holiday types created');

  // Create sample holidays for October 2025
  await prisma.holiday.upsert({
    where: { id: 'holiday_001' },
    update: {},
    create: {
      id: 'holiday_001',
      name: 'Eid Al-Fitr',
      description: 'Islamic holiday celebrating the end of Ramadan',
      startDate: new Date('2025-10-29'),
      endDate: new Date('2025-10-31'),
      holidayTypeId: publicHolidayType.id,
      duration: 3,
    },
  });

  // Create sample holidays for November 2025
  await prisma.holiday.upsert({
    where: { id: 'holiday_002' },
    update: {},
    create: {
      id: 'holiday_002',
      name: 'Founding Day',
      description: 'National founding day celebration',
      startDate: new Date('2025-11-02'),
      endDate: new Date('2025-11-02'),
      holidayTypeId: publicHolidayType.id,
      duration: 1,
    },
  });

  // Create sample holidays for December 2025
  await prisma.holiday.upsert({
    where: { id: 'holiday_003' },
    update: {},
    create: {
      id: 'holiday_003',
      name: 'New Year Holiday',
      description: 'New Year celebration',
      startDate: new Date('2025-12-31'),
      endDate: new Date('2026-01-02'),
      holidayTypeId: publicHolidayType.id,
      duration: 3,
    },
  });

  // Company holiday
  await prisma.holiday.upsert({
    where: { id: 'holiday_004' },
    update: {},
    create: {
      id: 'holiday_004',
      name: 'Company Foundation Day',
      description: 'YAZ Media company foundation anniversary',
      startDate: new Date('2025-10-15'),
      endDate: new Date('2025-10-15'),
      holidayTypeId: companyHolidayType.id,
      duration: 1,
    },
  });

  console.log('✅ Holidays created');

  // ============================================
  // CREATE REIMBURSEMENT TYPES
  // ============================================

  const travelType = await (prisma as any).reimbursementType.upsert({
    where: { name: 'Travel' },
    update: {},
    create: {
      name: 'Travel',
      description: 'Travel and transportation expenses including flights, hotels, and ground transportation',
      isActive: true,
    },
  });

  const mealsType = await (prisma as any).reimbursementType.upsert({
    where: { name: 'Meals' },
    update: {},
    create: {
      name: 'Meals',
      description: 'Meal and food expenses during business travel or client meetings',
      isActive: true,
    },
  });

  const officeSuppliesType = await (prisma as any).reimbursementType.upsert({
    where: { name: 'Office Supplies' },
    update: {},
    create: {
      name: 'Office Supplies',
      description: 'Office supplies and equipment for work purposes',
      isActive: true,
    },
  });

  const clientEntertainmentType = await (prisma as any).reimbursementType.upsert({
    where: { name: 'Client Entertainment' },
    update: {},
    create: {
      name: 'Client Entertainment',
      description: 'Client entertainment and business meal expenses',
      isActive: true,
    },
  });

  const trainingType = await (prisma as any).reimbursementType.upsert({
    where: { name: 'Training & Development' },
    update: {},
    create: {
      name: 'Training & Development',
      description: 'Training courses, certifications, and professional development',
      isActive: true,
    },
  });

  const communicationType = await (prisma as any).reimbursementType.upsert({
    where: { name: 'Communication' },
    update: {},
    create: {
      name: 'Communication',
      description: 'Phone, internet, and other communication expenses',
      isActive: true,
    },
  });

  console.log('✅ Reimbursement types created');

  // ============================================
  // CREATE SAMPLE REIMBURSEMENT CLAIMS
  // ============================================

  // Reimbursement 1 - John Doe - Travel (PENDING)
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Reimbursement" (id, "employeeId", "reimbursementTypeId", amount, description, "receiptUrl", status, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'reimb_001',
    itEmployee.id,
    travelType.id,
    1250.50,
    'Flight tickets and hotel for client meeting in Abu Dhabi',
    'https://storage.example.com/receipts/flight_abudhabi_001.pdf',
    'PENDING',
    new Date('2025-10-18T10:30:00Z'),
    new Date('2025-10-18T10:30:00Z')
  );

  // Reimbursement 2 - Priya Sharma - Meals (APPROVED)
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Reimbursement" (id, "employeeId", "reimbursementTypeId", amount, description, "receiptUrl", status, "approvedBy", "approvalDate", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'reimb_002',
    juniorDevEmployee.id,
    mealsType.id,
    185.75,
    'Team lunch during project kickoff meeting',
    'https://storage.example.com/receipts/team_lunch_002.pdf',
    'APPROVED',
    mgmtEmployee.email,
    new Date('2025-10-19T14:00:00Z'),
    new Date('2025-10-18T12:00:00Z'),
    new Date('2025-10-18T12:00:00Z')
  );

  // Reimbursement 3 - Michael Chen - Office Supplies (APPROVED)
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Reimbursement" (id, "employeeId", "reimbursementTypeId", amount, description, "receiptUrl", status, "approvedBy", "approvalDate", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'reimb_003',
    qaEmployee.id,
    officeSuppliesType.id,
    320.00,
    'Ergonomic chair and desk accessories for home office',
    'https://storage.example.com/receipts/office_supplies_003.pdf',
    'APPROVED',
    finEmployee.email,
    new Date('2025-10-17T11:30:00Z'),
    new Date('2025-10-16T09:15:00Z'),
    new Date('2025-10-16T09:15:00Z')
  );

  // Reimbursement 4 - Layla Al-Zahra - Client Entertainment (REJECTED)
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Reimbursement" (id, "employeeId", "reimbursementTypeId", amount, description, "receiptUrl", status, "rejectionReason", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'reimb_004',
    hrSpecEmployee.id,
    clientEntertainmentType.id,
    450.00,
    'Client dinner at premium restaurant',
    'https://storage.example.com/receipts/client_dinner_004.pdf',
    'REJECTED',
    'Amount exceeds approved limit for client entertainment. Please resubmit with adjusted amount.',
    new Date('2025-10-15T16:45:00Z'),
    new Date('2025-10-15T16:45:00Z')
  );

  // Reimbursement 5 - David Martinez - Training (PENDING)
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Reimbursement" (id, "employeeId", "reimbursementTypeId", amount, description, "receiptUrl", status, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'reimb_005',
    finOfficerEmployee.id,
    trainingType.id,
    599.99,
    'Advanced Excel and Financial Analysis online course',
    'https://storage.example.com/receipts/training_course_005.pdf',
    'PENDING',
    new Date('2025-10-19T13:20:00Z'),
    new Date('2025-10-19T13:20:00Z')
  );

  // Reimbursement 6 - Ahmed Hassan - Travel (APPROVED)
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Reimbursement" (id, "employeeId", "reimbursementTypeId", amount, description, "receiptUrl", status, "approvedBy", "approvalDate", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'reimb_006',
    mgmtEmployee.id,
    travelType.id,
    875.25,
    'Taxi and parking for client site visits',
    'https://storage.example.com/receipts/taxi_parking_006.pdf',
    'APPROVED',
    adminEmployee.email,
    new Date('2025-10-20T10:00:00Z'),
    new Date('2025-10-19T15:30:00Z'),
    new Date('2025-10-19T15:30:00Z')
  );

  // Reimbursement 7 - Emma Wilson - Communication (PENDING)
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Reimbursement" (id, "employeeId", "reimbursementTypeId", amount, description, "receiptUrl", status, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'reimb_007',
    finEmployee.id,
    communicationType.id,
    125.00,
    'International phone calls and video conferencing subscription',
    'https://storage.example.com/receipts/communication_007.pdf',
    'PENDING',
    new Date('2025-10-20T11:45:00Z'),
    new Date('2025-10-20T11:45:00Z')
  );

  // Reimbursement 8 - Sarah Johnson - Meals (APPROVED)
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "Reimbursement" (id, "employeeId", "reimbursementTypeId", amount, description, "receiptUrl", status, "approvedBy", "approvalDate", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'reimb_008',
    hrEmployee.id,
    mealsType.id,
    95.50,
    'Lunch meeting with recruitment agency',
    'https://storage.example.com/receipts/recruitment_lunch_008.pdf',
    'APPROVED',
    adminEmployee.email,
    new Date('2025-10-18T16:20:00Z'),
    new Date('2025-10-17T14:00:00Z'),
    new Date('2025-10-17T14:00:00Z')
  );

  console.log('✅ Reimbursement types and claims created');



  // ============================================
  // CREATE INVENTORY ITEMS
  // ============================================

  // Laptops
  await prisma.inventoryItem.upsert({
    where: { serialNumber: 'DELL-LAP-001' },
    update: {},
    create: {
      name: 'Dell XPS 13',
      category: 'LAPTOP',
      serialNumber: 'DELL-LAP-001',
      purchaseDate: new Date('2024-01-15'),
      purchaseCost: 1200,
      status: InventoryStatus.ASSIGNED,
      assignedTo: adminEmployee.id,
      assignedDate: new Date('2024-01-20'),
      notes: 'High-performance laptop for admin use',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { serialNumber: 'HP-LAP-002' },
    update: {},
    create: {
      name: 'HP Pavilion 15',
      category: 'LAPTOP',
      serialNumber: 'HP-LAP-002',
      purchaseDate: new Date('2024-02-10'),
      purchaseCost: 800,
      status: InventoryStatus.ASSIGNED,
      assignedTo: hrEmployee.id,
      assignedDate: new Date('2024-02-15'),
      notes: 'Standard laptop for HR department',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { serialNumber: 'LENOVO-LAP-003' },
    update: {},
    create: {
      name: 'Lenovo ThinkPad X1',
      category: 'LAPTOP',
      serialNumber: 'LENOVO-LAP-003',
      purchaseDate: new Date('2024-03-05'),
      purchaseCost: 1100,
      status: InventoryStatus.ASSIGNED,
      assignedTo: itEmployee.id,
      assignedDate: new Date('2024-03-10'),
      notes: 'Developer laptop with high specs',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { serialNumber: 'ASUS-LAP-004' },
    update: {},
    create: {
      name: 'ASUS VivoBook 14',
      category: 'LAPTOP',
      serialNumber: 'ASUS-LAP-004',
      purchaseDate: new Date('2024-04-01'),
      purchaseCost: 700,
      status: InventoryStatus.AVAILABLE,
      notes: 'Spare laptop available for assignment',
    },
  });

  // Monitors
  await prisma.inventoryItem.upsert({
    where: { serialNumber: 'DELL-MON-001' },
    update: {},
    create: {
      name: 'Dell UltraSharp 27"',
      category: 'MONITOR',
      serialNumber: 'DELL-MON-001',
      purchaseDate: new Date('2024-01-20'),
      purchaseCost: 400,
      status: InventoryStatus.ASSIGNED,
      assignedTo: itEmployee.id,
      assignedDate: new Date('2024-01-25'),
      notes: '4K monitor for development work',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { serialNumber: 'LG-MON-002' },
    update: {},
    create: {
      name: 'LG 24" IPS Monitor',
      category: 'MONITOR',
      serialNumber: 'LG-MON-002',
      purchaseDate: new Date('2024-02-15'),
      purchaseCost: 250,
      status: InventoryStatus.ASSIGNED,
      assignedTo: finEmployee.id,
      assignedDate: new Date('2024-02-20'),
      notes: 'Standard monitor for office use',
    },
  });

  await prisma.inventoryItem.upsert({
    where: { serialNumber: 'ASUS-MON-003' },
    update: {},
    create: {
      name: 'ASUS ProArt 32"',
      category: 'MONITOR',
      serialNumber: 'ASUS-MON-003',
      purchaseDate: new Date('2024-03-10'),
      purchaseCost: 600,
      status: InventoryStatus.AVAILABLE,
      notes: 'Professional monitor available',
    },
  });

  console.log('✅ Inventory items created');

  // ============================================
  // CREATE ASSETS
  // ============================================

  // Main assets - Laptops
  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-DELL-XPS-001' },
    update: {},
    create: {
      assetName: 'Dell XPS 13 Laptop',
      assetType: AssetType.MAIN_ASSET,
      category: AssetCategory.LAPTOP,
      serialNumber: 'ASSET-DELL-XPS-001',
      manufacturer: 'Dell',
      purchaseDate: new Date('2024-01-15'),
      purchaseCost: 1200,
      description: 'High-performance ultrabook for executive use',
      warrantyExpiration: new Date('2026-01-15'),
      location: 'Office - Floor 2',
      assignedToEmployeeId: adminEmployee.id,
      assignedDate: new Date('2024-01-20'),
      status: InventoryStatus.ASSIGNED,
    },
  });

  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-HP-PAVILION-002' },
    update: {},
    create: {
      assetName: 'HP Pavilion 15 Laptop',
      assetType: AssetType.MAIN_ASSET,
      category: AssetCategory.LAPTOP,
      serialNumber: 'ASSET-HP-PAVILION-002',
      manufacturer: 'HP',
      purchaseDate: new Date('2024-02-10'),
      purchaseCost: 800,
      description: 'Standard laptop for general office work',
      warrantyExpiration: new Date('2026-02-10'),
      location: 'Office - Floor 1',
      assignedToEmployeeId: hrEmployee.id,
      assignedDate: new Date('2024-02-15'),
      status: InventoryStatus.ASSIGNED,
    },
  });

  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-LENOVO-X1-003' },
    update: {},
    create: {
      assetName: 'Lenovo ThinkPad X1 Laptop',
      assetType: AssetType.MAIN_ASSET,
      category: AssetCategory.LAPTOP,
      serialNumber: 'ASSET-LENOVO-X1-003',
      manufacturer: 'Lenovo',
      purchaseDate: new Date('2024-03-05'),
      purchaseCost: 1100,
      description: 'Professional laptop for development',
      warrantyExpiration: new Date('2026-03-05'),
      location: 'Office - Floor 3',
      assignedToEmployeeId: itEmployee.id,
      assignedDate: new Date('2024-03-10'),
      status: InventoryStatus.ASSIGNED,
    },
  });

  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-ASUS-VIVOBOOK-004' },
    update: {},
    create: {
      assetName: 'ASUS VivoBook 14 Laptop',
      assetType: AssetType.MAIN_ASSET,
      category: AssetCategory.LAPTOP,
      serialNumber: 'ASSET-ASUS-VIVOBOOK-004',
      manufacturer: 'ASUS',
      purchaseDate: new Date('2024-04-01'),
      purchaseCost: 700,
      description: 'Portable laptop for field work',
      warrantyExpiration: new Date('2026-04-01'),
      location: 'Storage - Inventory Room',
      status: InventoryStatus.AVAILABLE,
    },
  });

  console.log('✅ Main assets (Laptops) created');

  // Accessories - Monitors
  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-DELL-MON-001' },
    update: {},
    create: {
      assetName: 'Dell UltraSharp 27" Monitor',
      assetType: AssetType.ACCESSORY,
      category: AssetCategory.MONITOR,
      serialNumber: 'ASSET-DELL-MON-001',
      manufacturer: 'Dell',
      purchaseDate: new Date('2024-01-20'),
      purchaseCost: 400,
      description: '4K UltraSharp monitor for professional work',
      warrantyExpiration: new Date('2026-01-20'),
      location: 'Office - Floor 3',
      assignedToEmployeeId: itEmployee.id,
      assignedDate: new Date('2024-01-25'),
      status: InventoryStatus.ASSIGNED,
    },
  });

  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-LG-MON-002' },
    update: {},
    create: {
      assetName: 'LG 24" IPS Monitor',
      assetType: AssetType.ACCESSORY,
      category: AssetCategory.MONITOR,
      serialNumber: 'ASSET-LG-MON-002',
      manufacturer: 'LG',
      purchaseDate: new Date('2024-02-15'),
      purchaseCost: 250,
      description: 'Standard IPS monitor for office use',
      warrantyExpiration: new Date('2026-02-15'),
      location: 'Office - Floor 1',
      assignedToEmployeeId: finEmployee.id,
      assignedDate: new Date('2024-02-20'),
      status: InventoryStatus.ASSIGNED,
    },
  });

  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-ASUS-MON-003' },
    update: {},
    create: {
      assetName: 'ASUS ProArt 32" Monitor',
      assetType: AssetType.ACCESSORY,
      category: AssetCategory.MONITOR,
      serialNumber: 'ASSET-ASUS-MON-003',
      manufacturer: 'ASUS',
      purchaseDate: new Date('2024-03-10'),
      purchaseCost: 600,
      description: 'Professional 32" monitor for design work',
      warrantyExpiration: new Date('2026-03-10'),
      location: 'Storage - Inventory Room',
      status: InventoryStatus.AVAILABLE,
    },
  });

  console.log('✅ Accessories (Monitors) created');

  // Accessories - Peripherals
  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-LOGITECH-KB-001' },
    update: {},
    create: {
      assetName: 'Logitech MX Keys Keyboard',
      assetType: AssetType.ACCESSORY,
      category: AssetCategory.KEYBOARD,
      serialNumber: 'ASSET-LOGITECH-KB-001',
      manufacturer: 'Logitech',
      purchaseDate: new Date('2024-01-25'),
      purchaseCost: 100,
      description: 'Wireless mechanical keyboard',
      warrantyExpiration: new Date('2025-01-25'),
      location: 'Office - Floor 2',
      assignedToEmployeeId: adminEmployee.id,
      assignedDate: new Date('2024-01-30'),
      status: InventoryStatus.ASSIGNED,
    },
  });

  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-LOGITECH-MOUSE-001' },
    update: {},
    create: {
      assetName: 'Logitech MX Master 3 Mouse',
      assetType: AssetType.ACCESSORY,
      category: AssetCategory.MOUSE,
      serialNumber: 'ASSET-LOGITECH-MOUSE-001',
      manufacturer: 'Logitech',
      purchaseDate: new Date('2024-01-25'),
      purchaseCost: 100,
      description: 'Advanced wireless mouse',
      warrantyExpiration: new Date('2025-01-25'),
      location: 'Office - Floor 2',
      assignedToEmployeeId: adminEmployee.id,
      assignedDate: new Date('2024-01-30'),
      status: InventoryStatus.ASSIGNED,
    },
  });

  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-SONY-HEADPHONES-001' },
    update: {},
    create: {
      assetName: 'Sony WH-1000XM5 Headphones',
      assetType: AssetType.ACCESSORY,
      category: AssetCategory.HEADPHONES,
      serialNumber: 'ASSET-SONY-HEADPHONES-001',
      manufacturer: 'Sony',
      purchaseDate: new Date('2024-02-01'),
      purchaseCost: 350,
      description: 'Noise-cancelling wireless headphones',
      warrantyExpiration: new Date('2026-02-01'),
      location: 'Office - Floor 3',
      assignedToEmployeeId: itEmployee.id,
      assignedDate: new Date('2024-02-05'),
      status: InventoryStatus.ASSIGNED,
    },
  });

  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-ANKER-CHARGER-001' },
    update: {},
    create: {
      assetName: 'Anker 65W USB-C Charger',
      assetType: AssetType.ACCESSORY,
      category: AssetCategory.CHARGER,
      serialNumber: 'ASSET-ANKER-CHARGER-001',
      manufacturer: 'Anker',
      purchaseDate: new Date('2024-02-10'),
      purchaseCost: 50,
      description: 'Fast charging USB-C power adapter',
      warrantyExpiration: new Date('2025-02-10'),
      location: 'Storage - Inventory Room',
      status: InventoryStatus.AVAILABLE,
    },
  });

  console.log('✅ Accessories (Peripherals) created');

  // Damaged and retired assets
  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-OLD-LAPTOP-001' },
    update: {},
    create: {
      assetName: 'Old Dell Inspiron Laptop',
      assetType: AssetType.MAIN_ASSET,
      category: AssetCategory.LAPTOP,
      serialNumber: 'ASSET-OLD-LAPTOP-001',
      manufacturer: 'Dell',
      purchaseDate: new Date('2022-06-15'),
      purchaseCost: 600,
      description: 'Retired laptop - no longer in use',
      warrantyExpiration: new Date('2024-06-15'),
      location: 'Storage - Retired Equipment',
      status: InventoryStatus.RETIRED,
    },
  });

  await prisma.asset.upsert({
    where: { serialNumber: 'ASSET-DAMAGED-MONITOR-001' },
    update: {},
    create: {
      assetName: 'Damaged Samsung Monitor',
      assetType: AssetType.ACCESSORY,
      category: AssetCategory.MONITOR,
      serialNumber: 'ASSET-DAMAGED-MONITOR-001',
      manufacturer: 'Samsung',
      purchaseDate: new Date('2023-08-20'),
      purchaseCost: 300,
      description: 'Monitor with cracked screen - awaiting repair',
      warrantyExpiration: new Date('2025-08-20'),
      location: 'Storage - Repair Queue',
      status: InventoryStatus.DAMAGED,
    },
  });

  console.log('✅ Damaged and retired assets created');

  // ============================================
  // CREATE PAYROLL RECORDS FOR OCTOBER 2025
  // ============================================

  const payrollMonth = 10;
  const payrollYear = 2025;

  // Admin - Fatima Al-Mansouri
  await prisma.payroll.upsert({
    where: { employeeId_month_year: { employeeId: adminEmployee.id, month: payrollMonth, year: payrollYear } },
    update: {},
    create: {
      employeeId: adminEmployee.id,
      month: payrollMonth,
      year: payrollYear,
      baseSalary: 8000,
      totalSalary: 13000,
      allowances: 500,
      deductions: 300,
      taxDeduction: 0,
      netSalary: 13200,
      status: 'PENDING',
    },
  });

  // HR - Sarah Johnson
  await prisma.payroll.upsert({
    where: { employeeId_month_year: { employeeId: hrEmployee.id, month: payrollMonth, year: payrollYear } },
    update: {},
    create: {
      employeeId: hrEmployee.id,
      month: payrollMonth,
      year: payrollYear,
      baseSalary: 6500,
      totalSalary: 10500,
      allowances: 400,
      deductions: 200,
      taxDeduction: 0,
      netSalary: 10700,
      status: 'PENDING',
    },
  });

  // Management - Ahmed Hassan
  await prisma.payroll.upsert({
    where: { employeeId_month_year: { employeeId: mgmtEmployee.id, month: payrollMonth, year: payrollYear } },
    update: {},
    create: {
      employeeId: mgmtEmployee.id,
      month: payrollMonth,
      year: payrollYear,
      baseSalary: 9000,
      totalSalary: 14500,
      allowances: 600,
      deductions: 350,
      taxDeduction: 0,
      netSalary: 14750,
      status: 'PENDING',
    },
  });

  // Finance - Emma Wilson
  await prisma.payroll.upsert({
    where: { employeeId_month_year: { employeeId: finEmployee.id, month: payrollMonth, year: payrollYear } },
    update: {},
    create: {
      employeeId: finEmployee.id,
      month: payrollMonth,
      year: payrollYear,
      baseSalary: 7500,
      totalSalary: 12000,
      allowances: 450,
      deductions: 250,
      taxDeduction: 0,
      netSalary: 12200,
      status: 'PENDING',
    },
  });

  // Employee - John Doe
  await prisma.payroll.upsert({
    where: { employeeId_month_year: { employeeId: itEmployee.id, month: payrollMonth, year: payrollYear } },
    update: {},
    create: {
      employeeId: itEmployee.id,
      month: payrollMonth,
      year: payrollYear,
      baseSalary: 8500,
      totalSalary: 14000,
      allowances: 600,
      deductions: 400,
      taxDeduction: 0,
      netSalary: 14200,
      status: 'PENDING',
    },
  });

  // Employee - Priya Sharma
  await prisma.payroll.upsert({
    where: { employeeId_month_year: { employeeId: juniorDevEmployee.id, month: payrollMonth, year: payrollYear } },
    update: {},
    create: {
      employeeId: juniorDevEmployee.id,
      month: payrollMonth,
      year: payrollYear,
      baseSalary: 6000,
      totalSalary: 9000,
      allowances: 300,
      deductions: 150,
      taxDeduction: 0,
      netSalary: 9150,
      status: 'PENDING',
    },
  });

  // Employee - Michael Chen
  await prisma.payroll.upsert({
    where: { employeeId_month_year: { employeeId: qaEmployee.id, month: payrollMonth, year: payrollYear } },
    update: {},
    create: {
      employeeId: qaEmployee.id,
      month: payrollMonth,
      year: payrollYear,
      baseSalary: 7000,
      totalSalary: 11000,
      allowances: 400,
      deductions: 200,
      taxDeduction: 0,
      netSalary: 11200,
      status: 'PENDING',
    },
  });

  // Employee - Layla Al-Zahra
  await prisma.payroll.upsert({
    where: { employeeId_month_year: { employeeId: hrSpecEmployee.id, month: payrollMonth, year: payrollYear } },
    update: {},
    create: {
      employeeId: hrSpecEmployee.id,
      month: payrollMonth,
      year: payrollYear,
      baseSalary: 5500,
      totalSalary: 8500,
      allowances: 250,
      deductions: 100,
      taxDeduction: 0,
      netSalary: 8650,
      status: 'PENDING',
    },
  });

  // Employee - David Martinez
  await prisma.payroll.upsert({
    where: { employeeId_month_year: { employeeId: finOfficerEmployee.id, month: payrollMonth, year: payrollYear } },
    update: {},
    create: {
      employeeId: finOfficerEmployee.id,
      month: payrollMonth,
      year: payrollYear,
      baseSalary: 6500,
      totalSalary: 10500,
      allowances: 350,
      deductions: 150,
      taxDeduction: 0,
      netSalary: 10700,
      status: 'PENDING',
    },
  });

  console.log('✅ Payroll records created for all employees');

  // ============================================
  // CREATE BONUSES
  // ============================================

  // Bonus for John Doe - Performance bonus
  await prisma.bonus.upsert({
    where: { id: 'bonus_001' },
    update: {},
    create: {
      id: 'bonus_001',
      employeeId: itEmployee.id,
      amount: 1000,
      reason: 'Q3 2025 Performance Bonus',
      month: 9,
      year: 2025,
    },
  });

  // Bonus for Ahmed Hassan - Management bonus
  await prisma.bonus.upsert({
    where: { id: 'bonus_002' },
    update: {},
    create: {
      id: 'bonus_002',
      employeeId: mgmtEmployee.id,
      amount: 1500,
      reason: 'Team Leadership Excellence',
      month: 10,
      year: 2025,
    },
  });

  // Bonus for Emma Wilson - Finance bonus
  await prisma.bonus.upsert({
    where: { id: 'bonus_003' },
    update: {},
    create: {
      id: 'bonus_003',
      employeeId: finEmployee.id,
      amount: 800,
      reason: 'Successful Audit Completion',
      month: 10,
      year: 2025,
    },
  });

  console.log('✅ Bonuses created');

  // ============================================
  // CREATE OVERTIME RECORDS
  // ============================================

  // John Doe - Overtime 1
  await prisma.overtime.upsert({
    where: { id: 'overtime_001' },
    update: {},
    create: {
      id: 'overtime_001',
      employeeId: itEmployee.id,
      date: new Date('2025-10-18'),
      hoursWorked: 10,
      overtimeHours: 2,
      rate: 1.25,
      amount: 416.67,
      status: OvertimeStatus.APPROVED,
      approvedBy: mgmtEmployee.id,
      approvalDate: new Date('2025-10-19'),
    },
  });

  // John Doe - Overtime 2
  await prisma.overtime.upsert({
    where: { id: 'overtime_002' },
    update: {},
    create: {
      id: 'overtime_002',
      employeeId: itEmployee.id,
      date: new Date('2025-10-19'),
      hoursWorked: 9,
      overtimeHours: 1,
      rate: 1.5,
      amount: 312.5,
      status: OvertimeStatus.APPROVED,
      approvedBy: mgmtEmployee.id,
      approvalDate: new Date('2025-10-20'),
    },
  });

  // Sarah Johnson - Overtime
  await prisma.overtime.upsert({
    where: { id: 'overtime_003' },
    update: {},
    create: {
      id: 'overtime_003',
      employeeId: hrEmployee.id,
      date: new Date('2025-10-20'),
      hoursWorked: 9.5,
      overtimeHours: 1.5,
      rate: 1.25,
      amount: 250,
      status: OvertimeStatus.PENDING,
    },
  });

  // Michael Chen - Overtime
  await prisma.overtime.upsert({
    where: { id: 'overtime_004' },
    update: {},
    create: {
      id: 'overtime_004',
      employeeId: qaEmployee.id,
      date: new Date('2025-10-17'),
      hoursWorked: 10,
      overtimeHours: 2,
      rate: 1.25,
      amount: 291.67,
      status: OvertimeStatus.APPROVED,
      approvedBy: mgmtEmployee.id,
      approvalDate: new Date('2025-10-18'),
    },
  });

  console.log('✅ Overtime records created');



  // ============================================
  // CREATE DEDUCTION RECORDS
  // ============================================

  // John Doe - Absence deduction
  await prisma.deduction.upsert({
    where: { id: 'deduction_001' },
    update: {},
    create: {
      id: 'deduction_001',
      employeeId: itEmployee.id,
      type: DeductionType.ABSENCE,
      amount: 500,
      reason: 'Absence on 2025-10-15',
      month: payrollMonth,
      year: payrollYear,
      status: DeductionStatus.APPROVED,
      approvedBy: mgmtEmployee.id,
      approvalDate: new Date('2025-10-16'),
    },
  });

  // Sarah Johnson - Loan deduction
  await prisma.deduction.upsert({
    where: { id: 'deduction_002' },
    update: {},
    create: {
      id: 'deduction_002',
      employeeId: hrEmployee.id,
      type: DeductionType.LOAN,
      amount: 1000,
      reason: 'Personal loan installment',
      month: payrollMonth,
      year: payrollYear,
      status: DeductionStatus.APPROVED,
      approvedBy: adminEmployee.id,
      approvalDate: new Date('2025-10-01'),
    },
  });

  // Emma Wilson - Advance deduction
  await prisma.deduction.upsert({
    where: { id: 'deduction_003' },
    update: {},
    create: {
      id: 'deduction_003',
      employeeId: finEmployee.id,
      type: DeductionType.ADVANCE,
      amount: 2000,
      reason: 'Salary advance for emergency',
      month: payrollMonth,
      year: payrollYear,
      status: DeductionStatus.PENDING,
    },
  });

  // Michael Chen - Disciplinary deduction
  await prisma.deduction.upsert({
    where: { id: 'deduction_004' },
    update: {},
    create: {
      id: 'deduction_004',
      employeeId: qaEmployee.id,
      type: DeductionType.DISCIPLINARY,
      amount: 300,
      reason: 'Late submission of test reports',
      month: payrollMonth,
      year: payrollYear,
      status: DeductionStatus.APPROVED,
      approvedBy: mgmtEmployee.id,
      approvalDate: new Date('2025-10-15'),
    },
  });

  console.log('✅ Deduction records created');

  // ============================================
  // CREATE SALARY CHANGE REQUESTS
  // ============================================

  // John Doe - Promotion
  await prisma.salaryChange.upsert({
    where: { id: 'salary_change_001' },
    update: {},
    create: {
      id: 'salary_change_001',
      employeeId: itEmployee.id,
      oldSalary: 14000,
      newSalary: 15000,
      changeType: SalaryChangeType.PROMOTION,
      reason: 'Promoted to Lead Developer',
      effectiveDate: new Date('2025-11-01'),
      status: SalaryChangeStatus.APPROVED_BY_FINANCE,
      approvedByHR: hrEmployee.id,
      approvedByHRDate: new Date('2025-10-18'),
      approvedByMgmt: mgmtEmployee.id,
      approvedByMgmtDate: new Date('2025-10-19'),
      approvedByFin: finEmployee.id,
      approvedByFinDate: new Date('2025-10-20'),
    },
  });

  // Sarah Johnson - Increment
  await prisma.salaryChange.upsert({
    where: { id: 'salary_change_002' },
    update: {},
    create: {
      id: 'salary_change_002',
      employeeId: hrEmployee.id,
      oldSalary: 10500,
      newSalary: 11000,
      changeType: SalaryChangeType.INCREMENT,
      reason: 'Annual performance increment',
      effectiveDate: new Date('2025-11-01'),
      status: SalaryChangeStatus.APPROVED_BY_MANAGEMENT,
      approvedByHR: adminEmployee.id,
      approvedByHRDate: new Date('2025-10-17'),
      approvedByMgmt: mgmtEmployee.id,
      approvedByMgmtDate: new Date('2025-10-19'),
    },
  });

  // Emma Wilson - Performance increase
  await prisma.salaryChange.upsert({
    where: { id: 'salary_change_003' },
    update: {},
    create: {
      id: 'salary_change_003',
      employeeId: finEmployee.id,
      oldSalary: 12000,
      newSalary: 13000,
      changeType: SalaryChangeType.PERFORMANCE,
      reason: 'Excellent performance in Q3 2025',
      effectiveDate: new Date('2025-12-01'),
      status: SalaryChangeStatus.PENDING,
    },
  });

  // Priya Sharma - Probation completion
  await prisma.salaryChange.upsert({
    where: { id: 'salary_change_004' },
    update: {},
    create: {
      id: 'salary_change_004',
      employeeId: juniorDevEmployee.id,
      oldSalary: 9000,
      newSalary: 9500,
      changeType: SalaryChangeType.PROBATION_COMPLETION,
      reason: 'Successful completion of probation period',
      effectiveDate: new Date('2025-10-15'),
      status: SalaryChangeStatus.APPROVED_BY_FINANCE,
      approvedByHR: hrEmployee.id,
      approvedByHRDate: new Date('2025-10-10'),
      approvedByMgmt: mgmtEmployee.id,
      approvedByMgmtDate: new Date('2025-10-12'),
      approvedByFin: finEmployee.id,
      approvedByFinDate: new Date('2025-10-14'),
    },
  });

  // Fatima Al-Mansouri - Rejected salary change
  await prisma.salaryChange.upsert({
    where: { id: 'salary_change_005' },
    update: {},
    create: {
      id: 'salary_change_005',
      employeeId: adminEmployee.id,
      oldSalary: 13000,
      newSalary: 14000,
      changeType: SalaryChangeType.INDUSTRY_STANDARD,
      reason: 'Market rate adjustment',
      effectiveDate: new Date('2025-10-01'),
      status: SalaryChangeStatus.REJECTED,
      rejectionReason: 'Budget constraints for this quarter',
      rejectedBy: finEmployee.id,
      rejectedDate: new Date('2025-10-18'),
    },
  });

  console.log('✅ Salary change requests created');

  console.log('✨ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

