const express = require('express');
const router = express.Router();
const db = require('../database/db');
const nodemailer = require('nodemailer');

router.get('/', (req, res) => {
  res.render('contact', { title: 'Contact – FurniSpace' });
});

router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.json({ success: false, error: 'Please fill in all required fields.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json({ success: false, error: 'Please enter a valid email address.' });
  }

  db.prepare('INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)')
    .run(name, email, subject || '', message);

  // Send email notification (fire and forget)
  if (process.env.EMAIL_USER && process.env.ADMIN_EMAIL) {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    transporter.sendMail({
      from: process.env.EMAIL_FROM || 'FurniSpace <no-reply@furnispace.ro>',
      to: process.env.ADMIN_EMAIL,
      replyTo: email,
      subject: `Contact Form: ${subject || 'No subject'} – from ${name}`,
      html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p><strong>Subject:</strong> ${subject || '-'}</p><p><strong>Message:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>`,
    }).catch(console.error);
  }

  res.json({ success: true, message: `Thanks, ${name}! We'll get back to you shortly.` });
});

module.exports = router;
