const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Aponta para a pasta do site
const pastaSite = path.join(__dirname, 'Projeto Inova', 'Projeto Inova', 'Projeto Inova');
app.use(express.static(pastaSite));

let db;

async function iniciarServidor() {
    // 1. Conecta e cria o arquivo banco.sqlite na pasta raiz
    db = await open({
        filename: path.join(__dirname, 'banco.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec('PRAGMA foreign_keys = ON;');

    // 2. Cria todas as 3 tabelas de uma vez
    await db.exec(`
        CREATE TABLE IF NOT EXISTS resenhas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_usuario TEXT NOT NULL,
            livro TEXT NOT NULL,
            nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
            texto TEXT NOT NULL,
            curtidas INTEGER DEFAULT 0,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS comentarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resenha_id INTEGER NOT NULL,
            nome_usuario TEXT NOT NULL,
            comentario TEXT NOT NULL,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (resenha_id) REFERENCES resenhas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            usuario TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            nascimento DATE NOT NULL,
            data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log('Banco SQLite conectado e as 3 tabelas estão prontas!');

    // 3. Só liga o servidor depois que o banco estiver 100% pronto
    app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
}

// --- ROTAS DE RESENHAS E COMENTÁRIOS ---
app.get('/api/resenhas', async (req, res) => {
    const resenhas = await db.all('SELECT * FROM resenhas ORDER BY data_criacao DESC');
    for (let resenha of resenhas) {
        resenha.comentarios = await db.all(
            'SELECT * FROM comentarios WHERE resenha_id = ? ORDER BY data_criacao ASC',
            [resenha.id]
        );
    }
    res.json(resenhas);
});

app.post('/api/resenhas', async (req, res) => {
    try {
        const { nome, livro, nota, texto } = req.body;
        const notaNumero = Number(nota);
        if (!nome || !livro || !texto || notaNumero < 1 || notaNumero > 5) {
            return res.status(400).json({ erro: 'Preencha todos os campos e escolha uma nota válida.' });
        }
        await db.run(
            'INSERT INTO resenhas (nome_usuario, livro, nota, texto) VALUES (?, ?, ?, ?)',
            [nome, livro, notaNumero, texto]
        );
        res.status(201).json({ mensagem: 'Resenha publicada!' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao salvar resenha.' });
    }
});

app.post('/api/resenhas/:id/curtir', async (req, res) => {
    await db.run('UPDATE resenhas SET curtidas = curtidas + 1 WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'Curtido!' });
});

app.post('/api/resenhas/:id/comentar', async (req, res) => {
    const { nome, comentario } = req.body;
    await db.run(
        'INSERT INTO comentarios (resenha_id, nome_usuario, comentario) VALUES (?, ?, ?)',
        [req.params.id, nome, comentario]
    );
    res.status(201).json({ mensagem: 'Comentário adicionado!' });
});

// --- ROTAS DE CADASTRO E LOGIN ---
app.post('/api/cadastro', async (req, res) => {
    try {
        const { nome, email, usuario, senha, nascimento } = req.body;
        const senhaHash = crypto.createHash('sha256').update(senha).digest('hex');

        await db.run(
            'INSERT INTO usuarios (nome, email, usuario, senha_hash, nascimento) VALUES (?, ?, ?, ?, ?)',
            [nome, email, usuario, senhaHash, nascimento]
        );
        res.status(201).json({ mensagem: 'Cadastro realizado com sucesso!' });
    } catch (erro) {
        if (erro.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ erro: 'E-mail ou nome de usuário já cadastrado.' });
        }
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao realizar cadastro.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { login, senha } = req.body;
        const senhaHash = crypto.createHash('sha256').update(senha).digest('hex');

        const usuarioEncontrado = await db.get(
            'SELECT id, nome, usuario, email FROM usuarios WHERE (email = ? OR usuario = ?) AND senha_hash = ?',
            [login, login, senhaHash]
        );

        if (!usuarioEncontrado) {
            return res.status(401).json({ erro: 'Usuário/e-mail ou senha incorretos.' });
        }
        res.json({ mensagem: 'Login realizado!', usuario: usuarioEncontrado });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao fazer login.' });
    }
});

// Inicia tudo
iniciarServidor();
