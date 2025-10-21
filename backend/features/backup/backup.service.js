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
    const filename = `shop_backup_${timestamp}.sql`;
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

      // Сохраняем информацию о бекапе в базу данных
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

  // Получить список всех бекапов
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

  // Получить путь к файлу бекапа
  async getBackupPath(filename) {
    const filepath = path.join(this.backupDir, filename);
    
    try {
      await fs.access(filepath);
      return filepath;
    } catch {
      throw new Error('Файл бекапа не найден');
    }
  }

  // Восстановить базу данных из бекапа
  async restoreFromBackup(filename) {
    const filepath = path.join(this.backupDir, filename);
    
    try {
      // Проверяем существование файла
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

      // Команда psql для восстановления
      const psqlCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${filepath}"`;
      
      // Устанавливаем переменную окружения для пароля
      const env = { ...process.env, PGPASSWORD: dbConfig.password };

      console.log('Восстановление базы данных...');
      await execAsync(psqlCommand, { env });

      console.log('База данных восстановлена успешно');
    } catch (error) {
      console.error('Ошибка восстановления:', error);
      throw new Error(`Не удалось восстановить базу данных: ${error.message}`);
    }
  }

  // Удалить бекап
  async deleteBackup(filename) {
    try {
      const client = await pool.connect();
      try {
        // Получаем информацию о бекапе из базы данных
        const result = await client.query(
          'SELECT file_path FROM backups WHERE filename = $1',
          [filename]
        );

        if (result.rows.length === 0) {
          throw new Error('Бекап не найден в базе данных');
        }

        const filepath = result.rows[0].file_path;

        // Удаляем файл с диска
        try {
          await fs.unlink(filepath);
          console.log(`Файл бекапа ${filename} удален с диска`);
        } catch (fileError) {
          console.warn(`Не удалось удалить файл ${filepath}:`, fileError.message);
        }

        // Удаляем запись из базы данных
        await client.query('DELETE FROM backups WHERE filename = $1', [filename]);
        console.log(`Бекап ${filename} удален из базы данных`);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Ошибка удаления бекапа:', error);
      throw new Error(`Не удалось удалить бекап: ${error.message}`);
    }
  }

  // Очистить старые бекапы (старше указанного количества дней)
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
