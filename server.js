const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middlewares
app.use(cors());
app.use(express.json());
app.use('/images', express.static('public/images')); // Servir imagens estáticas

// ✅ Configuração do multer (upload de imagens)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ✅ Banco de dados SQLite
const db = new sqlite3.Database('./database/db.sqlite');

// ✅ Criação da tabela
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS presentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            descricao TEXT,
            imagem TEXT,
            reservado INTEGER DEFAULT 0,
            reservado_por_nome TEXT,
            reservado_por_email TEXT
        )
    `);
});
// Remover reserva de um presente (Admin)
app.post('/api/admin/remover-reserva/:id', (req, res) => {
    const id = req.params.id;

    db.get('SELECT * FROM presentes WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Presente não encontrado.' });
        if (!row.reservado) return res.status(400).json({ error: 'Presente não está reservado.' });

        db.run(
            `UPDATE presentes 
             SET reservado = 0, reservado_por_nome = NULL, reservado_por_email = NULL 
             WHERE id = ?`,
            [id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Reserva removida com sucesso.' });
            }
        );
    });
});


app.post('/api/admin/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const url = `${req.protocol}://${req.get('host')}/images/${file.filename}`;
    console.log('Imagem salva em:', url);

    res.json({ imageUrl: url });
});

// ✅ Listar presentes
app.get('/api/presentes', (req, res) => {
    db.all('SELECT * FROM presentes', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ✅ Reservar presente
app.post('/api/reservar/:id', (req, res) => {
    const id = req.params.id;
    const { nome, email } = req.body;

    db.get('SELECT * FROM presentes WHERE id = ?', [id], (err, row) => {
        if (!row) return res.status(404).json({ error: 'Presente não encontrado' });
        if (row.reservado) return res.status(400).json({ error: 'Presente já reservado' });

        db.run(
            'UPDATE presentes SET reservado = 1, reservado_por_nome = ?, reservado_por_email = ? WHERE id = ?',
            [nome, email, id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Presente reservado com sucesso' });
            }
        );
    });
});

// ✅ Login Admin
app.post('/api/admin/login', (req, res) => {
    const { senha } = req.body;
    if (senha === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Senha incorreta' });
    }
});

// ✅ Adicionar presente
app.post('/api/admin/presentes', (req, res) => {
    const { nome, descricao, imagem } = req.body;
    if (!nome || !descricao || !imagem) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    db.run(
        'INSERT INTO presentes (nome, descricao, imagem) VALUES (?, ?, ?)',
        [nome, descricao, imagem],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// ✅ Editar presente
app.put('/api/admin/presentes/:id', (req, res) => {
    const id = req.params.id;
    const { nome, descricao, imagem, reservado } = req.body;

    db.run(
        'UPDATE presentes SET nome = ?, descricao = ?, imagem = ?, reservado = ? WHERE id = ?',
        [nome, descricao, imagem, reservado, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// ✅ Deletar presente
app.delete('/api/admin/presentes/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM presentes WHERE id = ?', id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ✅ Inicialização do servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
