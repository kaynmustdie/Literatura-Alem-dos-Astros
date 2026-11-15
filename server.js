const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Permite salvar fotos convertidas em texto

// Aponta para a pasta do site
const pastaSite = path.join(__dirname, 'Projeto Inova', 'Projeto Inova', 'Projeto Inova');
app.use(express.static(pastaSite));

//Redireciona para a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(pastaSite, 'html', 'index.html'));
});


let db;

async function iniciarServidor() {
    //Conecta e cria o arquivo banco.sqlite na pasta raiz
    db = await open({
        filename: path.join(__dirname, 'banco.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec('PRAGMA foreign_keys = ON;');

    //Cria todas as tabelas de uma vez
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

        CREATE TABLE IF NOT EXISTS curtidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resenha_id INTEGER NOT NULL,
        usuario TEXT NOT NULL,
        UNIQUE(resenha_id, usuario),
        FOREIGN KEY (resenha_id) REFERENCES resenhas(id) ON DELETE CASCADE
    );


       CREATE TABLE IF NOT EXISTS usuarios (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       nome TEXT NOT NULL,
       email TEXT UNIQUE NOT NULL,
       usuario TEXT UNIQUE NOT NULL,
       senha_hash TEXT NOT NULL,
       nascimento DATE NOT NULL,
       foto TEXT DEFAULT NULL,
       is_admin INTEGER DEFAULT 0,
       data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
);
    `);

    try {
        await db.exec('ALTER TABLE usuarios ADD COLUMN foto TEXT DEFAULT NULL;');
        console.log('Coluna foto adicionada com sucesso!');
    } catch (e) {
        //se a coluna já existir, ele a ignora
    }

    // Adiciona a coluna is_admin na tabela usuarios caso ela ainda não exista
    try {
        await db.exec('ALTER TABLE usuarios ADD COLUMN is_admin INTEGER DEFAULT 0;');
        console.log('Coluna is_admin adicionada com sucesso!');
    } catch (e) {
        // Se a coluna já existir no futuro, ele apenas ignora e segue normalmente
    }

    console.log('Banco SQLite conectado e as 3 tabelas estão prontas!');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

}

// --- ROTAS DE RESENHAS E COMENTÁRIOS ---
app.get('/api/resenhas', async (req, res) => {
    const resenhas = await db.all('SELECT * FROM resenhas ORDER BY data_criacao DESC');
    for (let resenha of resenhas) {
        resenha.comentarios = await db.all(
            'SELECT * FROM comentarios WHERE resenha_id = ? ORDER BY data_criacao ASC',
            [resenha.id]
        );
        // Busca a lista de nomes de usuários que curtiram esta resenha
        const listaCurtidas = await db.all(
            'SELECT usuario FROM curtidas WHERE resenha_id = ?',
            [resenha.id]
        );
        resenha.usuarios_curtiram = listaCurtidas.map(item => item.usuario);
    }
    res.json(resenhas);
});


// -- RESENHAS -- 
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

// Curtidas das resenhas
app.post('/api/resenhas/:id/curtir', async (req, res) => {
    try {
        const resenhaId = req.params.id;
        const { usuarioLogado } = req.body;

        if (!usuarioLogado) {
            return res.status(401).json({ erro: 'Você precisa estar logado para curtir.' });
        }

        // Verifica se este usuário já curtiu esta resenha
        const jaCurtiu = await db.get(
            'SELECT id FROM curtidas WHERE resenha_id = ? AND usuario = ?',
            [resenhaId, usuarioLogado]
        );

        if (jaCurtiu) {
            // Se já curtiu: remove o registro e diminui 1 do contador
            await db.run('DELETE FROM curtidas WHERE id = ?', [jaCurtiu.id]);
            await db.run('UPDATE resenhas SET curtidas = curtidas - 1 WHERE id = ?', [resenhaId]);
            return res.json({ mensagem: 'Curtida removida!', curtiu: false });
        } else {
            // Se ainda não curtiu: adiciona o registro e soma 1 no contador
            await db.run('INSERT INTO curtidas (resenha_id, usuario) VALUES (?, ?)', [resenhaId, usuarioLogado]);
            await db.run('UPDATE resenhas SET curtidas = curtidas + 1 WHERE id = ?', [resenhaId]);
            return res.json({ mensagem: 'Curtido!', curtiu: true });
        }
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao processar curtida.' });
    }
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

        const resultado = await db.run(
            'INSERT INTO usuarios (nome, email, usuario, senha_hash, nascimento) VALUES (?, ?, ?, ?, ?)',
            [nome, email, usuario, senhaHash, nascimento]
        );

        // É este bloco 'usuario' que preenche o perfil.html e o menu!
        res.status(201).json({
            mensagem: 'Cadastro realizado com sucesso!',
            usuario: {
                id: resultado.lastID,
                nome: nome,
                usuario: usuario,
                email: email,
                foto: null,
                is_admin: 0
            }
        });
    } catch (erro) {
        if (erro.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ erro: 'E-mail ou nome de usuário já cadastrado.' });
        }
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao realizar cadastro.' });
    }
});


//Login de usuário
app.post('/api/login', async (req, res) => {
    try {
        const { login, senha } = req.body;
        const senhaHash = crypto.createHash('sha256').update(senha).digest('hex');

    const usuarioEncontrado = await db.get(
    'SELECT id, nome, usuario, email, foto, is_admin FROM usuarios WHERE (email = ? OR usuario = ?) AND senha_hash = ?',
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

//ROTA DELETE - deleta os usuários permanentemente
app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const usuario = await db.get('SELECT usuario FROM usuarios WHERE id = ?', [id]);

        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }

        // Apaga todas as resenhas criadas por esse usuário
        await db.run('DELETE FROM resenhas WHERE nome_usuario = ?', [usuario.usuario]);

        // Apaga também os comentários que esse usuário fez nas resenhas de outras pessoas
        await db.run('DELETE FROM comentarios WHERE nome_usuario = ?', [usuario.usuario]);

        //Apaga as curtidas do usuário
        await db.run('DELETE FROM curtidas WHERE usuario = ?', [usuario.usuario]);

        // Por fim, apaga a conta do usuário
        await db.run('DELETE FROM usuarios WHERE id = ?', [id]);

     res.json({ mensagem: 'Conta e todas as publicações foram excluídas com sucesso!' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao excluir conta e publicações.' });
    }
});

// deleta resenhas caso seja o usuário ou admin
app.delete('/api/resenhas/:id', async (req, res) => {
    try {
        const resenhaId = req.params.id;
        const { usuarioLogado } = req.body;

        if (!usuarioLogado) {
            return res.status(401).json({ erro: 'Você precisa estar logado.' });
        }

        const resenha = await db.get('SELECT * FROM resenhas WHERE id = ?', [resenhaId]);
        const solicitante = await db.get('SELECT * FROM usuarios WHERE usuario = ?', [usuarioLogado]);

        if (!resenha || !solicitante) {
            return res.status(404).json({ erro: 'Resenha ou usuário não encontrado.' });
        }

        const ehAutor = resenha.nome_usuario === solicitante.usuario;
        const ehAdmin = Number(solicitante.is_admin) === 1;

        if (!ehAutor && !ehAdmin) {
            return res.status(403).json({ erro: 'Sem permissão para excluir esta resenha.' });
        }

        await db.run('DELETE FROM resenhas WHERE id = ?', [resenhaId]);
        res.json({ mensagem: 'Resenha excluída com sucesso!' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao excluir resenha.' });
    }
});


//Altera a foto do usuário  
app.put('/api/usuarios/:id/foto', async (req, res) => {
    try {
        const { foto } = req.body;
        await db.run('UPDATE usuarios SET foto = ? WHERE id = ?', [foto, req.params.id]);
        res.json({ mensagem: 'Foto atualizada com sucesso!' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao salvar foto no banco.' });
    }
});

// Rota POST: Salva nova resenha apenas se o usuário existir no banco
app.post('/api/resenhas', async (req, res) => {
    try {
        const { nome, livro, nota, texto } = req.body;
        const notaNumero = Number(nota);

        // Verifica se o usuário existe na tabela 'usuarios'
        const usuarioValido = await db.get('SELECT id FROM usuarios WHERE usuario = ?', [nome]);
        if (!usuarioValido) {
            return res.status(401).json({ erro: 'Apenas usuários cadastrados podem publicar resenhas.' });
        }

        if (!livro || !texto || notaNumero < 1 || notaNumero > 5) {
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

// rota post: configura as curtidas
app.post('/api/resenhas/:id/curtir', async (req, res) => {
    try {
        const resenhaId = req.params.id;
        const { usuarioLogado } = req.body;

        if (!usuarioLogado) {
            return res.status(401).json({ erro: 'Você precisa estar logado para curtir.' });
        }

        // Verifica se este usuário já curtiu esta resenha
        const jaCurtiu = await db.get(
            'SELECT id FROM curtidas WHERE resenha_id = ? AND usuario = ?',
            [resenhaId, usuarioLogado]
        );

        if (jaCurtiu) {
            // Se já curtiu: remove o registro e diminui 1 do contador
            await db.run('DELETE FROM curtidas WHERE id = ?', [jaCurtiu.id]);
            await db.run('UPDATE resenhas SET curtidas = curtidas - 1 WHERE id = ?', [resenhaId]);
            return res.json({ mensagem: 'Curtida removida!', curtiu: false });
        } else {
            // Se ainda não curtiu: adiciona o registro e soma 1 no contador
            await db.run('INSERT INTO curtidas (resenha_id, usuario) VALUES (?, ?)', [resenhaId, usuarioLogado]);
            await db.run('UPDATE resenhas SET curtidas = curtidas + 1 WHERE id = ?', [resenhaId]);
            return res.json({ mensagem: 'Curtido!', curtiu: true });
        }
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao processar curtida.' });
    }
});


// Rota POST: Salva comentário apenas se o usuário existir no banco
app.post('/api/resenhas/:id/comentar', async (req, res) => {
    try {
        const { nome, comentario } = req.body;

        const usuarioValido = await db.get('SELECT id FROM usuarios WHERE usuario = ?', [nome]);
        if (!usuarioValido) {
            return res.status(401).json({ erro: 'Apenas usuários cadastrados podem comentar.' });
        }

        await db.run(
            'INSERT INTO comentarios (resenha_id, nome_usuario, comentario) VALUES (?, ?, ?)',
            [req.params.id, nome, comentario]
        );
        res.status(201).json({ mensagem: 'Comentário adicionado!' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao comentar.' });
    }
});

// Rota delete - configura o delete de comentarios, para que só o usuario que escreveu possa apagar

app.delete('/api/comentarios/:id', async (req, res) => {
    try {
        const comentarioId = req.params.id;
        const { usuarioLogado } = req.body;

        if (!usuarioLogado) {
            return res.status(401).json({ erro: 'Você precisa estar logado.' });
        }

        const comentario = await db.get('SELECT * FROM comentarios WHERE id = ?', [comentarioId]);
        const solicitante = await db.get('SELECT * FROM usuarios WHERE usuario = ?', [usuarioLogado]);

        if (!comentario || !solicitante) {
            return res.status(404).json({ erro: 'Comentário ou usuário não encontrado.' });
        }

        const ehAutor = comentario.nome_usuario === solicitante.usuario;
        const ehAdmin = solicitante.is_admin === 1;

        if (!ehAutor && !ehAdmin) {
            return res.status(403).json({ erro: 'Sem permissão para excluir este comentário.' });
        }

        await db.run('DELETE FROM comentarios WHERE id = ?', [comentarioId]);
        res.json({ mensagem: 'Comentário excluído!' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro interno ao excluir comentário.' });
    }
});

// Inicia tudo
iniciarServidor();
