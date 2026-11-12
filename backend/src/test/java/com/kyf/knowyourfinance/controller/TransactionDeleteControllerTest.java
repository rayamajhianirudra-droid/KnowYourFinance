package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers FR-404 (delete a transaction), which had no automated test
 * before Milestone 4. Kept in its own class so the original controller
 * tests stay exactly as they were.
 */
@WebMvcTest(TransactionController.class)
class TransactionDeleteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TransactionRepository transactionRepository;

    @Test
    void deletingAnExistingTransactionReturns204AndRemovesIt() throws Exception {
        when(transactionRepository.existsById(7L)).thenReturn(true);

        mockMvc.perform(delete("/api/transactions/7"))
                .andExpect(status().isNoContent());

        verify(transactionRepository).deleteById(7L);
    }

    @Test
    void deletingAMissingTransactionReturns404AndDeletesNothing() throws Exception {
        when(transactionRepository.existsById(404L)).thenReturn(false);

        mockMvc.perform(delete("/api/transactions/404"))
                .andExpect(status().isNotFound());

        verify(transactionRepository, never()).deleteById(404L);
    }
}
