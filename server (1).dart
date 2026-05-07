import 'dart:convert';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as io;
import 'package:shelf_router/shelf_router.dart';
import 'package:mysql1/mysql1.dart';
import 'package:shelf_cors_headers/shelf_cors_headers.dart';

// ================== 1. DATABASE SETTINGS ==================
final settings = ConnectionSettings(
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: null, // XAMPP default
  db: 'student_db',
);

Future<MySqlConnection?> dbConnection() async {
  try {
    return await MySqlConnection.connect(settings);
  } catch (e) {
    print('❌ DATABASE CONNECTION FAILED: $e');
    return null;
  }
}

void main() async {
  final router = Router();

  // ------------------ A. STUDENT SIGNUP ------------------
  router.post('/add-student', (Request request) async {
    final payload = await request.readAsString();
    final body = jsonDecode(payload);
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();

    try {
      await conn.query(
        'INSERT INTO students (name, enrollment, email, department, password) VALUES (?, ?, ?, ?, ?)',
        [
          body['name'],
          body['enrollment'],
          body['email'],
          body['department'],
          body['password']
        ],
      );
      return Response.ok(
          jsonEncode({"status": "success", "message": "Account created!"}),
          headers: {'content-type': 'application/json'});
    } catch (e) {
      return Response.ok(
          jsonEncode({"status": "error", "message": "Signup failed"}),
          headers: {'content-type': 'application/json'});
    } finally {
      await conn.close();
    }
  });

  // ------------------ B. LOGIN (UPDATED WITH CASE-INSENSITIVE FIX) ------------------
  router.post('/login', (Request request) async {
    final payload = await request.readAsString();
    final body = jsonDecode(payload);
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();

    try {
      // Inputs ko clean kar rahe hain taake spaces aur capital letters ka masla na ho
      final String rawIdentifier =
          (body['enrollment'] ?? body['email'] ?? '').toString();
      final String identifier = rawIdentifier.trim().toLowerCase();

      final String password = (body['password'] ?? '').toString().trim();
      final String role = body['role'] ?? 'Student';

      if (role == 'Student') {
        var result = await conn.query(
          'SELECT name, enrollment FROM students WHERE (LOWER(enrollment) = ? OR LOWER(email) = ?) AND password = ?',
          [identifier, identifier, password],
        );
        if (result.isNotEmpty) {
          final row = result.first;
          return Response.ok(
              jsonEncode({
                "status": "success",
                "role": "Student",
                "name": row[0],
                "enrollment": row[1]
              }),
              headers: {'content-type': 'application/json'});
        }
      } else {
        // Teacher login with LOWER() to ignore Case Sensitivity
        var result = await conn.query(
          'SELECT name, department, course FROM teachers WHERE LOWER(email) = ? AND password = ?',
          [identifier, password],
        );
        if (result.isNotEmpty) {
          final row = result.first;
          return Response.ok(
              jsonEncode({
                "status": "success",
                "role": "Teacher",
                "name": row[0],
                "assignments": [
                  {"department": row[1], "course": row[2]}
                ]
              }),
              headers: {'content-type': 'application/json'});
        }
      }
      return Response.ok(
          jsonEncode({"status": "error", "message": "Invalid Credentials"}),
          headers: {'content-type': 'application/json'});
    } finally {
      await conn.close();
    }
  });

  // ------------------ C. GET STUDENTS BY DEPT ------------------
  router.get('/get-students/<dept>', (Request request, String dept) async {
    final decodedDept = Uri.decodeComponent(dept);
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();
    try {
      var result = await conn.query(
          'SELECT name, enrollment FROM students WHERE department = ?',
          [decodedDept]);
      var students =
          result.map((row) => {"name": row[0], "enrollment": row[1]}).toList();
      return Response.ok(jsonEncode(students),
          headers: {'content-type': 'application/json'});
    } finally {
      await conn.close();
    }
  });
// ------------------ H. GET STUDENT PROFILE (UPDATED & SECURE) ------------------
  router.get('/get-profile/<enrollment>',
      (Request request, String enrollment) async {
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();

    try {
      // Enrollment ko trim kar rahe hain taake extra spaces ka masla na ho
      final studentEnrollment = enrollment.trim();

      var result = await conn.query(
          'SELECT name, enrollment, email, department FROM students WHERE enrollment = ?',
          [studentEnrollment]);

      if (result.isNotEmpty) {
        final row = result.first;

        // Null-safety check: Agar koi field database mein null ho to khali string bheje
        final profileData = {
          "name": row[0]?.toString() ?? "N/A",
          "enrollment": row[1]?.toString() ?? "N/A",
          "email": row[2]?.toString() ?? "N/A",
          "department": row[3]?.toString() ?? "N/A",
          "status": "success"
        };

        return Response.ok(jsonEncode(profileData),
            headers: {'content-type': 'application/json'});
      } else {
        return Response.ok(
            jsonEncode({"status": "error", "message": "Student not found"}),
            headers: {'content-type': 'application/json'});
      }
    } catch (e) {
      print("❌ Error fetching profile: $e");
      return Response.internalServerError(
          body: jsonEncode({"status": "error", "message": e.toString()}));
    } finally {
      await conn.close();
    }
  });
  // ------------------ D. SUBMIT ATTENDANCE (With Single Date Check) ------------------
  router.post('/submit-attendance', (Request request) async {
    final payload = await request.readAsString();
    final body = jsonDecode(payload);
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();

    try {
      String course = body['course'];
      String date = body['date'];
      // Handling both 'attendance' and 'attendanceData' keys for safety
      var attendanceList = body['attendance'] ?? body['attendanceData'];

      var check = await conn.query(
          'SELECT id FROM attendance WHERE subject = ? AND date = ? LIMIT 1',
          [course, date]);

      if (check.isNotEmpty) {
        return Response.ok(
            jsonEncode({
              "status": "error",
              "message":
                  "Attendance for this course is already marked for today!"
            }),
            headers: {'content-type': 'application/json'});
      }

      for (var item in attendanceList) {
        await conn.query(
          'INSERT INTO attendance (enrollment, student_name, subject, status, date) VALUES (?, ?, ?, ?, ?)',
          [item['enrollment'], item['name'], course, item['status'], date],
        );
      }
      return Response.ok(
          jsonEncode({"status": "success", "message": "Attendance Saved!"}),
          headers: {'content-type': 'application/json'});
    } catch (e) {
      print("❌ Error: $e");
      return Response.ok(
          jsonEncode(
              {"status": "error", "message": "Failed to save attendance"}),
          headers: {'content-type': 'application/json'});
    } finally {
      await conn.close();
    }
  });

  // ------------------ E. GET ALL COURSES ------------------
  router.get('/get-all-courses', (Request request) async {
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();
    try {
      var result = await conn
          .query('SELECT course, name, email, department FROM teachers');
      var courses = result
          .map((row) => {
                "course_name": row[0],
                "instructor": row[1],
                "email": row[2],
                "dept": row[3]
              })
          .toList();
      return Response.ok(jsonEncode(courses),
          headers: {'content-type': 'application/json'});
    } finally {
      await conn.close();
    }
  });

  // ------------------ F. GET STUDENT ATTENDANCE HISTORY ------------------
  router.get('/get-attendance/<enrollment>',
      (Request request, String enrollment) async {
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();
    try {
      var result = await conn.query(
          'SELECT subject, status, date FROM attendance WHERE enrollment = ? ORDER BY date DESC',
          [enrollment]);
      var data = result
          .map((row) =>
              {"subject": row[0], "status": row[1], "date": row[2].toString()})
          .toList();
      return Response.ok(jsonEncode(data),
          headers: {'content-type': 'application/json'});
    } finally {
      await conn.close();
    }
  });

// ------------------ I. GET ATTENDANCE SUMMARY ------------------
  router.get('/get-attendance-summary/<enrollment>',
      (Request request, String enrollment) async {
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();
    try {
      final String studentEnrollment = enrollment.trim();
      var result = await conn.query('''
      SELECT subject, 
      COUNT(*) as total_classes, 
      SUM(CASE WHEN LOWER(status) = "present" THEN 1 ELSE 0 END) as attended
      FROM attendance 
      WHERE enrollment = ? 
      GROUP BY subject
    ''', [studentEnrollment]);

      var summary = result
          .map((row) => {
                "subject": row[0],
                "total_classes": row[1],
                "attended": row[2],
                "percentage": row[1] > 0
                    ? ((row[2] / row[1]) * 100).toStringAsFixed(1) + "%"
                    : "0.0%"
              })
          .toList();

      return Response.ok(jsonEncode(summary),
          headers: {'content-type': 'application/json'});
    } finally {
      await conn.close();
    }
  });
// ------------------ J. GET AVAILABLE COURSES (For Registration) ------------------
  router.get('/get-available-courses/<enrollment>',
      (Request request, String enrollment) async {
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();
    try {
      // HEC courses table se data utha rahe hain jo registration dropdown mein dikhega
      var result = await conn.query('SELECT course_name FROM hec_courses');
      var courses = result.map((row) => {"course_name": row[0]}).toList();

      return Response.ok(jsonEncode(courses),
          headers: {'content-type': 'application/json'});
    } catch (e) {
      return Response.internalServerError(
          body: jsonEncode({"error": e.toString()}));
    } finally {
      await conn.close();
    }
  });

  // ------------------ K. SUBMIT COURSE REGISTRATION ------------------
  router.post('/submit-registration', (Request request) async {
    final payload = await request.readAsString();
    final body = jsonDecode(payload);
    final conn = await dbConnection();
    if (conn == null) return Response.internalServerError();

    try {
      // Column 'phone' ko update karke 'phone_number' kar diya hai jo aapki table mein hai
      await conn.query(
        'INSERT INTO registrations (enrollment, course_name, phone_number, semester) VALUES (?, ?, ?, ?)',
        [body['enrollment'], body['course'], body['phone'], body['semester']],
      );
      return Response.ok(
          jsonEncode({
            "status": "success",
            "message": "Course Registered Successfully!"
          }),
          headers: {'content-type': 'application/json'});
    } catch (e) {
      print("❌ Registration Error: $e");
      return Response.ok(
          jsonEncode(
              {"status": "error", "message": "Backend Error: ${e.toString()}"}),
          headers: {'content-type': 'application/json'});
    } finally {
      await conn.close();
    }
  });
  // Middleware & Server Start
  final handler = const Pipeline()
      .addMiddleware(corsHeaders())
      .addMiddleware(logRequests())
      .addHandler(router);

  var server = await io.serve(handler, '0.0.0.0', 8081);
  print('🚀 Ziauddin Portal: Backend is ACTIVE on Port 8081');
}
