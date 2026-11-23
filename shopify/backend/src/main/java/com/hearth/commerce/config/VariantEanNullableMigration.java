package com.hearth.commerce.config;

import java.sql.DatabaseMetaData;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Variant EAN is optional (variant SKU remains the required identifier). Hibernate's
 * ddl-auto=update never relaxes an existing NOT NULL constraint, so databases created
 * before that change still reject variants without an EAN. This idempotent runner drops
 * the constraint once and is a no-op when the column is already nullable.
 */
@Component @Order(Ordered.HIGHEST_PRECEDENCE)
class VariantEanNullableMigration implements ApplicationRunner {
  private static final Logger log=LoggerFactory.getLogger(VariantEanNullableMigration.class);
  private static final String TABLE="product_variant";
  private static final String COLUMN="ean";
  private final DataSource dataSource;

  VariantEanNullableMigration(DataSource dataSource){this.dataSource=dataSource;}

  @Override public void run(ApplicationArguments args){
    try(var connection=dataSource.getConnection()){
      var meta=connection.getMetaData();
      String table=null,column=null;int size=255;boolean nullable=true;
      for(var candidate:new String[]{TABLE,TABLE.toUpperCase()}){
        try(var rs=meta.getColumns(connection.getCatalog(),null,candidate,null)){
          while(rs.next()){
            if(!COLUMN.equalsIgnoreCase(rs.getString("COLUMN_NAME")))continue;
            table=rs.getString("TABLE_NAME");column=rs.getString("COLUMN_NAME");
            size=rs.getInt("COLUMN_SIZE")>0?rs.getInt("COLUMN_SIZE"):255;
            nullable=rs.getInt("NULLABLE")!=DatabaseMetaData.columnNoNulls;
          }
        }
        if(table!=null)break;
      }
      if(table==null||nullable)return;
      var product=String.valueOf(meta.getDatabaseProductName()).toLowerCase();
      var sql=product.contains("mysql")||product.contains("mariadb")
          ?"ALTER TABLE "+table+" MODIFY "+column+" VARCHAR("+size+") NULL"
          :"ALTER TABLE "+table+" ALTER COLUMN "+column+" SET NULL";
      try(var statement=connection.createStatement()){statement.execute(sql);}
      log.info("Relaxed NOT NULL constraint on {}.{} so variant EAN is optional",table,column);
    }catch(Exception e){
      log.warn("Could not relax NOT NULL on {}.{}: {}",TABLE,COLUMN,e.getMessage());
    }
  }
}
