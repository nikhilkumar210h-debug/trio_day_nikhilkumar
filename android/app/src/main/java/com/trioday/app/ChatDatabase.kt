package com.trioday.app

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * ChatDatabase — local SQLite store for Trio Day 1:1 chat messages.
 *
 * Design principles (per user request):
 *   - Chat lives in SQLite on the device, NOT in Firestore.
 *   - Only chat MESSAGES are subject to auto-cleanup (older than 30 days).
 *   - The SQLite database itself is under USER control — the app never
 *     auto-deletes the database file. It is removed only when the user
 *     uninstalls the app or clears app data.
 */
object ChatDatabase {

    private const val DB_NAME = "trio_day_chat.db"
    private const val DB_VERSION = 1

    // Auto-cleanup threshold: messages older than 30 days are deleted.
    private const val CHAT_MAX_AGE_MS = 30L * 24 * 60 * 60 * 1000

    private var instance: ChatOpenHelper? = null

    fun init(context: Context) {
        if (instance == null) {
            instance = ChatOpenHelper(context.applicationContext)
        }
    }

    private fun helper(): ChatOpenHelper {
        val h = instance ?: throw IllegalStateException("ChatDatabase not initialized. Call init(context) first.")
        return h
    }

    /** Returns a writable database (caller must close). */
    fun writable(): SQLiteDatabase = helper().writableDatabase

    /** Returns a readable database (caller must close). */
    fun readable(): SQLiteDatabase = helper().readableDatabase

    /**
     * Delete chat messages older than 30 days across all peers.
     * Call this on app start / when opening the chat screen.
     * Does NOT touch the database file itself.
     */
    suspend fun cleanupOldMessages(): Int = withContext(Dispatchers.IO) {
        val db = writable()
        try {
            val cutoff = System.currentTimeMillis() - CHAT_MAX_AGE_MS
            val deleted = db.delete(
                "chat_messages",
                "created_at_ms < ?",
                arrayOf(cutoff.toString())
            )
            db.execSQL("VACUUM")
            deleted
        } finally {
            db.close()
        }
    }

    private class ChatOpenHelper(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    peer_uid TEXT NOT NULL,
                    uid TEXT NOT NULL,
                    name TEXT,
                    text TEXT NOT NULL,
                    created_at_ms INTEGER NOT NULL,
                    seen INTEGER DEFAULT 0,
                    is_mine INTEGER DEFAULT 0
                )
            """.trimIndent())

            db.execSQL("""
                CREATE INDEX IF NOT EXISTS idx_chat_peer_created
                ON chat_messages(peer_uid, created_at_ms DESC)
            """.trimIndent())

            db.execSQL("""
                CREATE INDEX IF NOT EXISTS idx_chat_peer_uid
                ON chat_messages(peer_uid, uid)
            """.trimIndent())
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            // No migration needed yet — bump DB_VERSION and add ALTER TABLE here when schema changes.
        }
    }
}
