const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const { Pool } = require('pg');

const execAsync = promisify(exec);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '5432',
  database: process.env.DB_NAME || 'shop',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1*'
});

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../../backups');
    this.ensureBackupDir();
  }

  async ensureBackupDir() {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  async createBackup(userId = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `shop_backup_${timestamp}.bak`;
    const filepath = path.join(this.backupDir, filename);

    try {
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '5432',
        database: process.env.DB_NAME || 'shop',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1*'
      };

      const pgDumpCommand = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${filepath}"`;

      const env = { ...process.env, PGPASSWORD: dbConfig.password };

      console.log('Создание бекапа...');
      await execAsync(pgDumpCommand, { env });

      const stats = await fs.stat(filepath);
      const fileSizeInMB = parseFloat((stats.size / (1024 * 1024)).toFixed(2));

      console.log(`Бекап создан: ${filename} (${fileSizeInMB} MB)`);

      const client = await pool.connect();
      try {
        const result = await client.query(
          `INSERT INTO backups (filename, file_path, file_size_mb, created_by, description) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING backup_id, created_at`,
          [filename, filepath, fileSizeInMB, userId, `Ручной бекап от ${new Date().toLocaleString('ru-RU')}`]
        );

        return {
          backupId: result.rows[0].backup_id,
          filename,
          filepath,
          size: fileSizeInMB,
          createdAt: result.rows[0].created_at
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Ошибка создания бекапа:', error);
      throw new Error(`Не удалось создать бекап: ${error.message}`);
    }
  }

  async getBackupsList() {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT 
            b.backup_id,
            b.filename,
            b.file_size_mb,
            b.created_at,
            b.description,
            b.is_automatic,
            u.first_name,
            u.last_name,
            u.email
          FROM backups b
          LEFT JOIN users u ON b.created_by = u.user_id
          ORDER BY b.created_at DESC
        `);

        return result.rows.map(row => ({
          backupId: row.backup_id,
          filename: row.filename,
          size: parseFloat(row.file_size_mb).toFixed(2),
          createdAt: row.created_at,
          description: row.description,
          isAutomatic: row.is_automatic,
          createdBy: row.first_name && row.last_name ? 
            `${row.first_name} ${row.last_name}` : 
            (row.email || 'Система')
        }));
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Ошибка получения списка бекапов:', error);
      throw new Error(`Не удалось получить список бекапов: ${error.message}`);
    }
  }

  async getBackupPath(filename) {
    const filepath = path.join(this.backupDir, filename);
    
    try {
      await fs.access(filepath);
      return filepath;
    } catch {
      throw new Error('Файл бекапа не найден');
    }
  }

  async restoreFromBackup(filename) {
    const filepath = path.join(this.backupDir, filename);
    
    try {
      await fs.access(filepath);
    } catch {
      throw new Error('Файл бекапа не найден');
    }

    try {
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '5432',
        database: process.env.DB_NAME || 'shop',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1*'
      };

      const psqlCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${filepath}"`;

      const env = { ...process.env, PGPASSWORD: dbConfig.password };

      console.log('Восстановление базы данных...');
      await execAsync(psqlCommand, { env });

      console.log('База данных восстановлена успешно');
    } catch (error) {
      console.error('Ошибка восстановления:', error);
      throw new Error(`Не удалось восстановить базу данных: ${error.message}`);
    }
  }

  async restoreFromUploadedFile(filePath, userId = null) {
    try {
      console.log('Начинаем восстановление из файла:', filePath);

      await fs.access(filePath);
      const fileStats = await fs.stat(filePath);
      console.log('Файл существует, размер:', fileStats.size, 'байт');
      console.log('Расширение файла:', path.extname(filePath));

      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '5432',
        database: process.env.DB_NAME || 'shop',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1*'
      };

      console.log('Конфигурация БД:', { ...dbConfig, password: '***' });

      const psqlCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${filePath}"`;
      
      console.log('Выполняем команду:', psqlCommand.replace(dbConfig.password, '***'));

      const env = { ...process.env, PGPASSWORD: dbConfig.password };

      console.log('Восстановление базы данных из загруженного файла...');
      const result = await execAsync(psqlCommand, { env });
      
      console.log('Результат выполнения psql:', result.stdout);
      if (result.stderr) {
        console.warn('Предупреждения psql:', result.stderr);
      }

      console.log('База данных восстановлена из загруженного файла успешно');
    } catch (error) {
      console.error('Ошибка восстановления из загруженного файла:', error);
      console.error('Детали ошибки:', {
        message: error.message,
        code: error.code,
        signal: error.signal,
        stdout: error.stdout,
        stderr: error.stderr
      });
      throw new Error(`Не удалось восстановить базу данных: ${error.message}`);
    }
  }

  async deleteBackup(filename) {
    try {
      console.log(`Начинаем удаление бекапа: ${filename}`);
      
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT file_path, file_size_mb FROM backups WHERE filename = $1',
          [filename]
        );

        if (result.rows.length === 0) {
          throw new Error('Бекап не найден в базе данных');
        }

        const filepath = result.rows[0].file_path;
        const fileSize = result.rows[0].file_size_mb;
        
        console.log(`Найден бекап в БД: ${filepath}, размер: ${fileSize} MB`);

        let fileExists = false;
        try {
          await fs.access(filepath);
          fileExists = true;
          console.log(`Файл существует: ${filepath}`);
        } catch (accessError) {
          console.warn(`Файл не найден на диске: ${filepath}`);
        }

        if (fileExists) {
          try {
            await fs.unlink(filepath);
            console.log(`✅ Файл бекапа ${filename} успешно удален с диска: ${filepath}`);
          } catch (fileError) {
            console.error(`❌ Ошибка удаления файла ${filepath}:`, fileError.message);
            throw new Error(`Не удалось удалить файл с диска: ${fileError.message}`);
          }
        } else {
          console.warn(`⚠️ Файл ${filepath} не найден на диске, но запись в БД будет удалена`);
        }

        const deleteResult = await client.query('DELETE FROM backups WHERE filename = $1', [filename]);
        console.log(`✅ Запись бекапа ${filename} удалена из базы данных (удалено записей: ${deleteResult.rowCount})`);
        
        return {
          success: true,
          message: `Бекап ${filename} успешно удален`,
          fileDeleted: fileExists,
          recordsDeleted: deleteResult.rowCount
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Ошибка удаления бекапа:', error);
      throw new Error(`Не удалось удалить бекап: ${error.message}`);
    }
  }

  async cleanupOldBackups(daysToKeep = 30) {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.sql'));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      let deletedCount = 0;
      
      for (const file of backupFiles) {
        const filepath = path.join(this.backupDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.birthtime < cutoffDate) {
          await fs.unlink(filepath);
          deletedCount++;
          console.log(`Удален старый бекап: ${file}`);
        }
      }
      
      console.log(`Удалено ${deletedCount} старых бекапов`);
      return deletedCount;
    } catch (error) {
      console.error('Ошибка очистки старых бекапов:', error);
      throw new Error(`Не удалось очистить старые бекапы: ${error.message}`);
    }
  }
}

module.exports = new BackupService();
